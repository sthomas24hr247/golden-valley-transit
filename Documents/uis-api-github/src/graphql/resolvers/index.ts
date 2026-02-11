/**
 * UIS Orchestrate API - GraphQL Resolvers
 */

import { GraphQLError } from 'graphql';
import { PMSAdapter } from '../../adapters/adapter.interface';
import { logger } from '../../utils/logger';

// =============================================================================
// CONTEXT TYPE
// =============================================================================

export interface GraphQLContext {
  user?: {
    userId: string;
    email?: string;
    practiceId?: string;
    roles: string[];
    permissions: string[];
  };
  practiceId?: string;
  adapter: PMSAdapter;
  requestId: string;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function requireAuth(context: GraphQLContext): void {
  if (!context.user) {
    throw new GraphQLError('Authentication required', {
      extensions: { code: 'UNAUTHENTICATED' },
    });
  }
}

function requirePractice(context: GraphQLContext): void {
  if (!context.practiceId) {
    throw new GraphQLError('Practice context required', {
      extensions: { code: 'BAD_REQUEST' },
    });
  }
}

function handleResult<T>(result: { success: true; data: T } | { success: false; error: { code: string; message: string } }): T {
  if (!result.success) {
    throw new GraphQLError(result.error.message, {
      extensions: { code: result.error.code },
    });
  }
  return result.data;
}

// Type for paginated results
interface PaginatedResult<T> {
  data: T[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
}

// =============================================================================
// RESOLVERS
// =============================================================================

export const resolvers = {
  // ===========================================================================
  // QUERIES
  // ===========================================================================
  Query: {
    // Patient Queries
    patient: async (
      _: unknown,
      args: { id: string },
      context: GraphQLContext
    ) => {
      requireAuth(context);
      requirePractice(context);
      
      const result = await context.adapter.getPatient(args.id);
      return handleResult(result);
    },
    
    patients: async (
      _: unknown,
      args: { filters?: Record<string, unknown>; pagination?: { limit: number; offset: number } },
      context: GraphQLContext
    ) => {
      requireAuth(context);
      requirePractice(context);
      
      const result = await context.adapter.listPatients(
        args.filters as any,
        args.pagination
      );
      const data = handleResult(result) as PaginatedResult<any>;
      
      return {
        data: data.data,
        pageInfo: data.pagination,
      };
    },
    
    searchPatients: async (
      _: unknown,
      args: { query: string },
      context: GraphQLContext
    ) => {
      requireAuth(context);
      requirePractice(context);
      
      const result = await context.adapter.searchPatients(args.query);
      return handleResult(result);
    },
    
    // Appointment Queries
    appointment: async (
      _: unknown,
      args: { id: string },
      context: GraphQLContext
    ) => {
      requireAuth(context);
      requirePractice(context);
      
      const result = await context.adapter.getAppointment(args.id);
      return handleResult(result);
    },
    
    appointments: async (
      _: unknown,
      args: { filters?: Record<string, unknown>; pagination?: { limit: number; offset: number } },
      context: GraphQLContext
    ) => {
      requireAuth(context);
      requirePractice(context);
      
      const result = await context.adapter.listAppointments(
        args.filters as any,
        args.pagination
      );
      const data = handleResult(result) as PaginatedResult<any>;
      
      return {
        data: data.data,
        pageInfo: data.pagination,
      };
    },
    
    availableSlots: async (
      _: unknown,
      args: { providerId: string; dateFrom: string; dateTo: string; durationMinutes: number },
      context: GraphQLContext
    ) => {
      requireAuth(context);
      requirePractice(context);
      
      const result = await context.adapter.getAvailableSlots(
        args.providerId,
        args.dateFrom,
        args.dateTo,
        args.durationMinutes
      );
      return handleResult(result);
    },
    
    // Procedure Queries
    procedure: async (
      _: unknown,
      args: { id: string },
      context: GraphQLContext
    ) => {
      requireAuth(context);
      requirePractice(context);
      
      const result = await context.adapter.getProcedure(args.id);
      return handleResult(result);
    },
    
    procedures: async (
      _: unknown,
      args: { filters?: Record<string, unknown>; pagination?: { limit: number; offset: number } },
      context: GraphQLContext
    ) => {
      requireAuth(context);
      requirePractice(context);
      
      const result = await context.adapter.listProcedures(
        args.filters as any,
        args.pagination
      );
      const data = handleResult(result) as PaginatedResult<any>;
      
      return {
        data: data.data,
        pageInfo: data.pagination,
      };
    },
    
    // Claim Queries
    claim: async (
      _: unknown,
      args: { id: string },
      context: GraphQLContext
    ) => {
      requireAuth(context);
      requirePractice(context);
      
      const result = await context.adapter.getClaim(args.id);
      return handleResult(result);
    },
    
    claims: async (
      _: unknown,
      args: { filters?: Record<string, unknown>; pagination?: { limit: number; offset: number } },
      context: GraphQLContext
    ) => {
      requireAuth(context);
      requirePractice(context);
      
      const result = await context.adapter.listClaims(
        args.filters as any,
        args.pagination
      );
      const data = handleResult(result) as PaginatedResult<any>;
      
      return {
        data: data.data,
        pageInfo: data.pagination,
      };
    },
    
    // Reference Data
    providers: async (_: unknown, __: unknown, context: GraphQLContext) => {
      requireAuth(context);
      requirePractice(context);
      
      const result = await context.adapter.listProviders();
      return handleResult(result);
    },
    
    operatories: async (_: unknown, __: unknown, context: GraphQLContext) => {
      requireAuth(context);
      requirePractice(context);
      
      const result = await context.adapter.listOperatories();
      return handleResult(result);
    },
    
    // Health Check (no auth required)
    health: async (_: unknown, __: unknown, context: GraphQLContext) => {
      const health = await context.adapter.healthCheck();
      
      return {
        isHealthy: health.isHealthy,
        latencyMs: health.latencyMs,
        lastChecked: health.lastChecked.toISOString(),
        pmsConnected: health.details?.apiReachable ?? false,
        databaseConnected: health.details?.databaseConnected ?? true,
        cacheConnected: true,
      };
    },
  },
  
  // ===========================================================================
  // MUTATIONS
  // ===========================================================================
  Mutation: {
    createPatient: async (
      _: unknown,
      args: { input: Record<string, unknown> },
      context: GraphQLContext
    ) => {
      requireAuth(context);
      requirePractice(context);
      
      logger.info('Creating patient', { 
        requestId: context.requestId,
        practiceId: context.practiceId,
      });
      
      const result = await context.adapter.createPatient(args.input as any);
      return handleResult(result);
    },
    
    updatePatient: async (
      _: unknown,
      args: { id: string; input: Record<string, unknown> },
      context: GraphQLContext
    ) => {
      requireAuth(context);
      requirePractice(context);
      
      const result = await context.adapter.updatePatient(args.id, args.input as any);
      return handleResult(result);
    },
    
    createAppointment: async (
      _: unknown,
      args: { input: Record<string, unknown> },
      context: GraphQLContext
    ) => {
      requireAuth(context);
      requirePractice(context);
      
      logger.info('Creating appointment', { 
        requestId: context.requestId,
        practiceId: context.practiceId,
      });
      
      const result = await context.adapter.createAppointment(args.input as any);
      return handleResult(result);
    },
    
    updateAppointment: async (
      _: unknown,
      args: { id: string; input: Record<string, unknown> },
      context: GraphQLContext
    ) => {
      requireAuth(context);
      requirePractice(context);
      
      const result = await context.adapter.updateAppointment(args.id, args.input as any);
      return handleResult(result);
    },
    
    updateAppointmentStatus: async (
      _: unknown,
      args: { id: string; status: string; notes?: string },
      context: GraphQLContext
    ) => {
      requireAuth(context);
      requirePractice(context);
      
      logger.info('Updating appointment status', { 
        requestId: context.requestId,
        appointmentId: args.id,
        newStatus: args.status,
      });
      
      const result = await context.adapter.updateAppointmentStatus(
        args.id,
        args.status as any,
        args.notes
      );
      return handleResult(result);
    },
    
    cancelAppointment: async (
      _: unknown,
      args: { id: string; reason?: string },
      context: GraphQLContext
    ) => {
      requireAuth(context);
      requirePractice(context);
      
      const result = await context.adapter.cancelAppointment(args.id, args.reason);
      return handleResult(result);
    },
    
    createProcedure: async (
      _: unknown,
      args: { input: Record<string, unknown> },
      context: GraphQLContext
    ) => {
      requireAuth(context);
      requirePractice(context);
      
      const result = await context.adapter.createProcedure(args.input as any);
      return handleResult(result);
    },
    
    updateProcedure: async (
      _: unknown,
      args: { id: string; input: Record<string, unknown> },
      context: GraphQLContext
    ) => {
      requireAuth(context);
      requirePractice(context);
      
      const result = await context.adapter.updateProcedure(args.id, args.input as any);
      return handleResult(result);
    },
    
    completeProcedure: async (
      _: unknown,
      args: { id: string },
      context: GraphQLContext
    ) => {
      requireAuth(context);
      requirePractice(context);
      
      const result = await context.adapter.completeProcedure(args.id);
      return handleResult(result);
    },
  },
  
  // ===========================================================================
  // FIELD RESOLVERS
  // ===========================================================================
  Patient: {
    appointments: async (
      parent: { patientId: string },
      args: { filters?: Record<string, unknown>; pagination?: { limit: number; offset: number } },
      context: GraphQLContext
    ) => {
      const result = await context.adapter.listAppointments(
        { ...args.filters, patientId: parent.patientId } as any,
        args.pagination
      );
      const data = handleResult(result) as PaginatedResult<any>;
      return { data: data.data, pageInfo: data.pagination };
    },
    
    procedures: async (
      parent: { patientId: string },
      args: { filters?: Record<string, unknown>; pagination?: { limit: number; offset: number } },
      context: GraphQLContext
    ) => {
      const result = await context.adapter.listProcedures(
        { ...args.filters, patientId: parent.patientId } as any,
        args.pagination
      );
      const data = handleResult(result) as PaginatedResult<any>;
      return { data: data.data, pageInfo: data.pagination };
    },
    
    insurancePlans: async (
      parent: { sourceId: string },
      _: unknown,
      context: GraphQLContext
    ) => {
      const result = await context.adapter.getPatientInsurance(parent.sourceId);
      return handleResult(result);
    },
    
    balance: async (
      parent: { sourceId: string },
      _: unknown,
      context: GraphQLContext
    ) => {
      const result = await context.adapter.getPatientBalance(parent.sourceId);
      return handleResult(result);
    },
  },
  
  Provider: {
    fullName: (parent: { firstName: string; lastName: string }) => {
      return `${parent.firstName} ${parent.lastName}`;
    },
  },
  
  InsurancePlan: {
    annualRemaining: (parent: { annualMax?: number; annualUsed?: number }) => {
      if (parent.annualMax === undefined) return null;
      return parent.annualMax - (parent.annualUsed || 0);
    },
  },
};
