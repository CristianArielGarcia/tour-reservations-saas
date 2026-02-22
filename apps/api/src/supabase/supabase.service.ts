import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private supabaseClient: SupabaseClient;

  constructor(private readonly config: ConfigService) {
    const supabaseUrl = this.config.get<string>('SUPABASE_URL');
    const serviceRoleKey = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment');
    }

    this.supabaseClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  /**
   * Invite a user by email to join an agency.
   * Creates a new user in Supabase Auth with an invitation link.
   */
  async inviteUser(email: string): Promise<{ userId: string }> {
    const { data, error } = await this.supabaseClient.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${this.config.get<string>('APP_FRONTEND_URL', 'http://localhost:3000')}/auth/callback`,
    });

    if (error) {
      throw new Error(`Failed to invite user: ${error.message}`);
    }

    if (!data.user?.id) {
      throw new Error('Failed to create user invitation: no user ID returned');
    }

    return { userId: data.user.id };
  }
}
