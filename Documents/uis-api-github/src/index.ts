/**
 * UIS Orchestrate API - Main Entry Point
 */

import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { mergeTypeDefs, mergeResolvers } from '@graphql-tools/merge';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { readFileSync } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

import { logger, createRequestLogger } from './utils/logger';
import { AuthenticatedRequest } from './middleware/auth.middleware';
import { resolvers, GraphQLContext } from './graphql/resolvers';
import { dentamindResolvers } from './graphql/resolvers/dentamind.resolvers';
import { getPool, isConnected as isSqlConnected, closePool } from './db/azure-sql';
import { adapterManager } from './services/adapter-manager';

import './adapters/open-dental.adapter';

const PORT = process.env.PORT || 4000;
const isDevelopment = process.env.NODE_ENV !== 'production';

// Load and merge schemas
const baseTypeDefs = readFileSync(join(__dirname, 'graphql/schema/schema.graphql'), 'utf-8');
const dentamindTypeDefs = readFileSync(join(__dirname, 'graphql/schema/dentamind.graphql'), 'utf-8');
const mergedTypeDefs = mergeTypeDefs([baseTypeDefs, dentamindTypeDefs]);
const mergedResolvers = mergeResolvers([resolvers, dentamindResolvers]);
const schema = makeExecutableSchema({ typeDefs: mergedTypeDefs, resolvers: mergedResolvers });

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);

  // Trust proxy for Azure Container Apps (required for rate limiting behind load balancer)
  app.set('trust proxy', 1);

  // Initialize Azure SQL
  try {
    await getPool();
    logger.info('✅ Azure SQL connected');
  } catch (error) {
    logger.warn('⚠️ Azure SQL connection failed', { error });
  }

  app.use(helmet({ contentSecurityPolicy: isDevelopment ? false : undefined, crossOriginEmbedderPolicy: isDevelopment ? false : undefined }));
  app.use(compression());
  
  const corsOrigins = process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:5173', 'https://uishealth.com', 'https://app.uishealth.com', 'https://lemon-ground-032413110.3.azurestaticapps.net'];
  app.use(cors({ origin: isDevelopment ? true : corsOrigins, credentials: true }));
  
  app.use(rateLimit({ windowMs: 60000, max: 100, message: { error: 'Too many requests' }, standardHeaders: true, legacyHeaders: false }));
  app.use(express.json({ limit: '10mb' }));
  
  app.use((req: Request, res: Response, next: NextFunction) => {
    (req as any).requestId = req.headers['x-request-id'] || uuidv4();
    res.setHeader('x-request-id', (req as any).requestId);
    next();
  });

  app.get('/health', (req, res) => res.json({ status: 'healthy', timestamp: new Date().toISOString() }));
  app.get('/health/ready', async (req, res) => {
    const sqlConnected = await isSqlConnected();
    res.json({ status: 'ready', checks: { api: true, azureSql: sqlConnected } });
  });
  app.get('/', (req, res) => res.json({ name: 'UIS Orchestrate API', version: '1.0.0', graphql: '/graphql' }));

  const apolloServer = new ApolloServer<GraphQLContext>({
    schema,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      {
        async requestDidStart({ request, contextValue }) {
          const log = createRequestLogger(contextValue.requestId, contextValue.practiceId);
          log.debug('GraphQL request started', { operationName: request.operationName });
          return {
            async didEncounterErrors({ errors }) {
              for (const error of errors) {
                log.error('GraphQL error', { message: error.message, path: error.path });
              }
            },
          };
        },
      },
    ],
    formatError: (formattedError) => {
      if (!isDevelopment && formattedError.extensions?.code === 'INTERNAL_SERVER_ERROR') {
        return { message: 'An internal error occurred', extensions: { code: 'INTERNAL_SERVER_ERROR' } };
      }
      return formattedError;
    },
    introspection: true,
  });
  
  await apolloServer.start();
  
  app.use('/graphql', expressMiddleware(apolloServer, {
    context: async ({ req }): Promise<GraphQLContext> => {
      const authReq = req as AuthenticatedRequest;
      
      // In development, skip authentication and use mock user
      // In production, validate JWT token from Authorization header
      if (isDevelopment) {
        // Mock user for development
        authReq.user = {
          userId: 'dev-user',
          email: 'dev@uishealth.com',
          practiceId: 'mock-practice',
          roles: ['admin'],
          permissions: ['*'],
        };
      } else {
        // Production: Validate JWT token
        // TODO: Implement proper JWT validation for production
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          // Token validation would go here
          // For now, allow requests without auth in production too
          // This should be properly implemented before going live
        }
      }
      
      const practiceId = 
        (req.headers['x-practice-id'] as string) || 
        authReq.user?.practiceId || 
        (isDevelopment ? 'mock-practice' : 'demo-practice');
      
      let adapter;
      try {
        adapterManager.registerPractice({ practiceId, pmsType: 'MOCK' as any, credentials: {} });
        adapter = await adapterManager.getAdapter(practiceId);
      } catch {
        adapterManager.registerPractice({ practiceId, pmsType: 'MOCK' as any, credentials: {} });
        adapter = await adapterManager.getAdapter(practiceId);
      }
      
      return { 
        user: authReq.user, 
        practiceId, 
        adapter, 
        requestId: (authReq as any).requestId || uuidv4() 
      };
    },
  }));

  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    logger.error('Unhandled error', { error: err.message });
    res.status(500).json({ error: isDevelopment ? err.message : 'Internal server error' });
  });

  await new Promise<void>((resolve) => httpServer.listen(PORT, resolve));
  logger.info(`🚀 UIS Orchestrate API running on port ${PORT}`, { 
    environment: isDevelopment ? 'development' : 'production',
    features: ['Dentamind Analytics', 'PMS Adapters']
  });
  return { app, httpServer, apolloServer };
}

async function shutdown() { 
  logger.info('Shutting down...'); 
  await closePool(); 
  process.exit(0); 
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

startServer().catch((error) => { 
  logger.error('Failed to start server', { error }); 
  process.exit(1); 
});
