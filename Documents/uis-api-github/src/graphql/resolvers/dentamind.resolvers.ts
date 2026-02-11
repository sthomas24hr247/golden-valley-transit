/**
 * Dentamind Analytics Resolvers
 * 
 * Uses the vw_dentamind_* views in Azure SQL
 */

import { getPool, sql } from '../../db/azure-sql';
import { logger } from '../../utils/logger';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function formatDate(date: any): string | null {
  if (!date) return null;
  if (date instanceof Date) return date.toISOString().split('T')[0];
  if (typeof date === 'string' && date.includes('T')) return date.split('T')[0];
  return String(date);
}

function formatPatient(row: any): any {
  return {
    id: row.id,
    firstName: row.firstName || '',
    lastName: row.lastName || '',
    email: row.email,
    phone: row.phone,
    dateOfBirth: formatDate(row.dateOfBirth),
    gender: row.gender,
    insuranceProvider: row.insuranceProvider,
    status: row.status || 'active',
    balance: row.balance || 0,
    address: row.address,
    lastVisit: formatDate(row.lastVisit),
    nextAppointment: formatDate(row.nextAppointment),
    createdAt: row.createdAt?.toISOString?.() || row.createdAt,
  };
}

function formatAppointment(row: any): any {
  return {
    id: row.id,
    patientId: row.patientId,
    patientName: row.patientName || 'Unknown Patient',
    type: row.type || 'checkup',
    status: row.status || 'scheduled',
    date: formatDate(row.date),
    time: row.time || '00:00',
    duration: row.duration || 30,
    provider: row.provider || 'Unknown Provider',
    notes: row.notes,
    createdAt: row.createdAt?.toISOString?.() || row.createdAt,
  };
}

function formatTreatment(row: any): any {
  return {
    id: row.id,
    patientId: row.patientId,
    patientName: row.patientName || 'Unknown Patient',
    name: row.name || '',
    code: row.code,
    category: row.category || 'other',
    status: row.status || 'proposed',
    cost: row.cost || 0,
    insuranceCoverage: row.insuranceCoverage || 0,
    patientPaid: row.patientPaid || 0,
    date: formatDate(row.date),
    provider: row.provider || 'Unknown Provider',
    toothNumber: row.toothNumber,
    surface: row.surface,
    createdAt: row.createdAt?.toISOString?.() || row.createdAt,
  };
}

// =============================================================================
// RESOLVERS
// =============================================================================

export const dentamindResolvers = {
  Query: {
    dashboardStats: async () => {
      try {
        const pool = await getPool();
        const result = await pool.request().query(`
          SELECT * FROM vw_dentamind_dashboard_stats
        `);
        const row = result.recordset[0] || {};
        return {
          totalRevenue: row.totalRevenue || 0,
          revenueChange: row.revenueChange || 0,
          activePatients: row.activePatients || 0,
          patientChange: row.patientChange || 0,
          appointmentsToday: row.appointmentsToday || 0,
          treatmentAcceptance: row.treatmentAcceptance || 0,
          noShowRate: row.noShowRate || 0,
          pendingTreatments: row.pendingTreatments || 0,
        };
      } catch (error) {
        logger.error('Error fetching dashboard stats', { error });
        throw error;
      }
    },

    revenueMetrics: async (_: any, args: { months?: number }) => {
      try {
        const pool = await getPool();
        const months = args.months || 12;
        const result = await pool.request()
          .input('months', sql.Int, months)
          .query(`
            SELECT TOP (@months)
              id, [date], production, collections, adjustments,
              new_patients as newPatients,
              total_appointments as totalAppointments,
              cancelled_appointments as cancelledAppointments,
              treatment_acceptance_rate as treatmentAcceptanceRate
            FROM revenue_metrics
            ORDER BY [date] DESC
          `);
        return result.recordset.map((row: any) => ({
          ...row,
          id: row.id,
          date: formatDate(row.date),
        }));
      } catch (error) {
        logger.error('Error fetching revenue metrics', { error });
        throw error;
      }
    },

    treatmentBreakdown: async () => {
      try {
        const pool = await getPool();
        const result = await pool.request().query(`
          SELECT * FROM vw_dentamind_treatment_breakdown
        `);
        return result.recordset.map((row: any) => ({
          category: row.category || 'Other',
          count: row.count || 0,
          revenue: row.revenue || 0,
        }));
      } catch (error) {
        logger.error('Error fetching treatment breakdown', { error });
        throw error;
      }
    },

    recentAppointments: async (_: any, args: { limit?: number }) => {
      try {
        const pool = await getPool();
        const limit = args.limit || 10;
        const result = await pool.request()
          .input('limit', sql.Int, limit)
          .query(`
            SELECT TOP (@limit) *
            FROM vw_dentamind_recent_appointments
            WHERE [date] >= CAST(GETDATE() AS DATE)
            ORDER BY [date], [time]
          `);
        return result.recordset.map(formatAppointment);
      } catch (error) {
        logger.error('Error fetching recent appointments', { error });
        throw error;
      }
    },

    todaysAppointments: async () => {
      try {
        const pool = await getPool();
        const result = await pool.request().query(`
          SELECT *
          FROM vw_dentamind_recent_appointments
          WHERE [date] = CAST(GETDATE() AS DATE)
          ORDER BY [time]
        `);
        return result.recordset.map(formatAppointment);
      } catch (error) {
        logger.error('Error fetching today\'s appointments', { error });
        throw error;
      }
    },

    dentamindPatients: async (_: any, args: { status?: string; search?: string; limit?: number; offset?: number }) => {
      try {
        const pool = await getPool();
        const limit = args.limit || 50;
        const offset = args.offset || 0;
        let whereClause = '1=1';
        const request = pool.request();
        if (args.status && args.status !== 'all') {
          whereClause += ' AND status = @status';
          request.input('status', sql.NVarChar, args.status);
        }
        if (args.search) {
          whereClause += ` AND (firstName LIKE @search OR lastName LIKE @search OR email LIKE @search)`;
          request.input('search', sql.NVarChar, `%${args.search}%`);
        }
        request.input('limit', sql.Int, limit);
        request.input('offset', sql.Int, offset);
        const result = await request.query(`
          SELECT * FROM vw_dentamind_patients
          WHERE ${whereClause}
          ORDER BY lastName, firstName
          OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
        `);
        return result.recordset.map(formatPatient);
      } catch (error) {
        logger.error('Error fetching patients', { error });
        throw error;
      }
    },

    dentamindPatient: async (_: any, args: { id: string }) => {
      try {
        const pool = await getPool();
        const result = await pool.request()
          .input('id', sql.UniqueIdentifier, args.id)
          .query(`SELECT * FROM vw_dentamind_patients WHERE id = @id`);
        return result.recordset[0] ? formatPatient(result.recordset[0]) : null;
      } catch (error) {
        logger.error('Error fetching patient', { error, id: args.id });
        throw error;
      }
    },

    dentamindAppointments: async (_: any, args: { status?: string; date?: string; limit?: number; offset?: number }) => {
      try {
        const pool = await getPool();
        const limit = args.limit || 50;
        const offset = args.offset || 0;
        let whereClause = '1=1';
        const request = pool.request();
        if (args.status && args.status !== 'all') {
          whereClause += ' AND status = @status';
          request.input('status', sql.NVarChar, args.status);
        }
        if (args.date) {
          whereClause += ' AND [date] = @date';
          request.input('date', sql.Date, args.date);
        }
        request.input('limit', sql.Int, limit);
        request.input('offset', sql.Int, offset);
        const result = await request.query(`
          SELECT * FROM vw_dentamind_recent_appointments
          WHERE ${whereClause}
          ORDER BY [date] DESC, [time]
          OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
        `);
        return result.recordset.map(formatAppointment);
      } catch (error) {
        logger.error('Error fetching appointments', { error });
        throw error;
      }
    },

    dentamindTreatments: async (_: any, args: { status?: string; category?: string; patientId?: string; limit?: number; offset?: number }) => {
      try {
        const pool = await getPool();
        const limit = args.limit || 50;
        const offset = args.offset || 0;
        let whereClause = '1=1';
        const request = pool.request();
        if (args.status && args.status !== 'all') {
          whereClause += ' AND status = @status';
          request.input('status', sql.NVarChar, args.status);
        }
        if (args.category) {
          whereClause += ' AND category = @category';
          request.input('category', sql.NVarChar, args.category);
        }
        if (args.patientId) {
          whereClause += ' AND patientId = @patientId';
          request.input('patientId', sql.UniqueIdentifier, args.patientId);
        }
        request.input('limit', sql.Int, limit);
        request.input('offset', sql.Int, offset);
        const result = await request.query(`
          SELECT * FROM vw_dentamind_treatments
          WHERE ${whereClause}
          ORDER BY createdAt DESC
          OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
        `);
        return result.recordset.map(formatTreatment);
      } catch (error) {
        logger.error('Error fetching treatments', { error });
        throw error;
      }
    },
  },

  Mutation: {
    createDentamindPatient: async (_: any, { input }: { input: any }) => {
      try {
        const pool = await getPool();
        const result = await pool.request()
          .input('firstName', sql.NVarChar, input.firstName)
          .input('lastName', sql.NVarChar, input.lastName)
          .input('email', sql.NVarChar, input.email)
          .input('phone', sql.NVarChar, input.phone)
          .input('dateOfBirth', sql.Date, input.dateOfBirth)
          .input('gender', sql.NVarChar, input.gender)
          .input('insuranceInfo', sql.NVarChar, input.insuranceProvider)
          .input('status', sql.NVarChar, input.status || 'active')
          .input('address', sql.NVarChar, input.address)
          .query(`
            INSERT INTO patients (first_name, last_name, email, phone, date_of_birth, gender, insurance_info, status, address, created_at, updated_at)
            OUTPUT INSERTED.*
            VALUES (@firstName, @lastName, @email, @phone, @dateOfBirth, @gender, @insuranceInfo, @status, @address, GETUTCDATE(), GETUTCDATE())
          `);
        const patient = result.recordset[0];
        return { id: patient.id, firstName: patient.first_name, lastName: patient.last_name, email: patient.email, phone: patient.phone, status: patient.status };
      } catch (error) {
        logger.error('Error creating patient', { error });
        throw error;
      }
    },

    deleteDentamindPatient: async (_: any, { id }: { id: string }) => {
      try {
        const pool = await getPool();
        const result = await pool.request().input('id', sql.UniqueIdentifier, id).query('DELETE FROM patients WHERE id = @id');
        return result.rowsAffected[0] > 0;
      } catch (error) {
        logger.error('Error deleting patient', { error, id });
        throw error;
      }
    },

    createDentamindAppointment: async (_: any, { input }: { input: any }) => {
      try {
        const pool = await getPool();
        const result = await pool.request()
          .input('patientId', sql.UniqueIdentifier, input.patientId)
          .input('providerId', sql.UniqueIdentifier, input.providerId)
          .input('type', sql.NVarChar, input.type)
          .input('dateTime', sql.DateTime2, input.dateTime)
          .input('duration', sql.Int, input.duration || 30)
          .input('notes', sql.NVarChar, input.notes)
          .query(`
            INSERT INTO appointments (patient_id, provider_id, type, date_time, duration, notes, status, created_at, updated_at)
            OUTPUT INSERTED.id
            VALUES (@patientId, @providerId, @type, @dateTime, @duration, @notes, 'scheduled', GETUTCDATE(), GETUTCDATE())
          `);
        const id = result.recordset[0].id;
        const fullResult = await pool.request().input('id', sql.UniqueIdentifier, id).query('SELECT * FROM vw_dentamind_recent_appointments WHERE id = @id');
        return formatAppointment(fullResult.recordset[0]);
      } catch (error) {
        logger.error('Error creating appointment', { error });
        throw error;
      }
    },

    deleteDentamindAppointment: async (_: any, { id }: { id: string }) => {
      try {
        const pool = await getPool();
        const result = await pool.request().input('id', sql.UniqueIdentifier, id).query('DELETE FROM appointments WHERE id = @id');
        return result.rowsAffected[0] > 0;
      } catch (error) {
        logger.error('Error deleting appointment', { error, id });
        throw error;
      }
    },

    createDentamindTreatment: async (_: any, { input }: { input: any }) => {
      try {
        const pool = await getPool();
        const result = await pool.request()
          .input('patientId', sql.UniqueIdentifier, input.patientId)
          .input('providerId', sql.UniqueIdentifier, input.providerId)
          .input('description', sql.NVarChar, input.description)
          .input('code', sql.NVarChar, input.code)
          .input('category', sql.NVarChar, input.category)
          .input('fee', sql.Decimal(12, 2), input.fee)
          .input('toothNumber', sql.NVarChar, input.toothNumber)
          .input('surface', sql.NVarChar, input.surface)
          .query(`
            INSERT INTO procedures (patient_id, provider_id, description, code, category, fee, tooth_number, surface, status, created_at, updated_at)
            OUTPUT INSERTED.id
            VALUES (@patientId, @providerId, @description, @code, @category, @fee, @toothNumber, @surface, 'proposed', GETUTCDATE(), GETUTCDATE())
          `);
        const id = result.recordset[0].id;
        const fullResult = await pool.request().input('id', sql.UniqueIdentifier, id).query('SELECT * FROM vw_dentamind_treatments WHERE id = @id');
        return formatTreatment(fullResult.recordset[0]);
      } catch (error) {
        logger.error('Error creating treatment', { error });
        throw error;
      }
    },

    deleteDentamindTreatment: async (_: any, { id }: { id: string }) => {
      try {
        const pool = await getPool();
        const result = await pool.request().input('id', sql.UniqueIdentifier, id).query('DELETE FROM procedures WHERE id = @id');
        return result.rowsAffected[0] > 0;
      } catch (error) {
        logger.error('Error deleting treatment', { error, id });
        throw error;
      }
    },
  },
};

export default dentamindResolvers;
