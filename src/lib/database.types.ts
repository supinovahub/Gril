export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      invitation_claims: {
        Row: {
          claimed_at: string
          id: string
          invitation_link_id: string
          org_id: string
          token_hash: string
          user_id: string
        }
        Insert: {
          claimed_at?: string
          id?: string
          invitation_link_id: string
          org_id: string
          token_hash: string
          user_id?: string
        }
        Update: {
          claimed_at?: string
          id?: string
          invitation_link_id?: string
          org_id?: string
          token_hash?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitation_claims_invitation_link_id_fkey"
            columns: ["invitation_link_id"]
            isOneToOne: false
            referencedRelation: "invitation_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitation_claims_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invitation_links: {
        Row: {
          created_at: string
          created_by: string
          email: string | null
          expires_at: string
          id: string
          kind: string
          max_uses: number
          operation_id: string | null
          org_id: string
          role: string
          status: string
          token_hash: string
          updated_at: string
          used_count: number
        }
        Insert: {
          created_at?: string
          created_by?: string
          email?: string | null
          expires_at: string
          id?: string
          kind?: string
          max_uses?: number
          operation_id?: string | null
          org_id: string
          role?: string
          status?: string
          token_hash: string
          updated_at?: string
          used_count?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          email?: string | null
          expires_at?: string
          id?: string
          kind?: string
          max_uses?: number
          operation_id?: string | null
          org_id?: string
          role?: string
          status?: string
          token_hash?: string
          updated_at?: string
          used_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "invitation_links_operation_id_org_id_fkey"
            columns: ["operation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "invitation_links_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_change_requests: {
        Row: {
          actor_user_id: string
          created_at: string
          id: string
          membership_id: string
          org_id: string
          processed_at: string
          requested_action: string
          requested_role: string | null
        }
        Insert: {
          actor_user_id?: string
          created_at?: string
          id?: string
          membership_id: string
          org_id: string
          processed_at?: string
          requested_action: string
          requested_role?: string | null
        }
        Update: {
          actor_user_id?: string
          created_at?: string
          id?: string
          membership_id?: string
          org_id?: string
          processed_at?: string
          requested_action?: string
          requested_role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "membership_change_requests_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_change_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_operations: {
        Row: {
          created_at: string
          membership_id: string
          operation_id: string
          org_id: string
        }
        Insert: {
          created_at?: string
          membership_id: string
          operation_id: string
          org_id: string
        }
        Update: {
          created_at?: string
          membership_id?: string
          operation_id?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "membership_operations_membership_id_org_id_fkey"
            columns: ["membership_id", "org_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "membership_operations_operation_id_org_id_fkey"
            columns: ["operation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
      membership_permissions: {
        Row: {
          created_at: string
          membership_id: string
          permission: string
        }
        Insert: {
          created_at?: string
          membership_id: string
          permission: string
        }
        Update: {
          created_at?: string
          membership_id?: string
          permission?: string
        }
        Relationships: [
          {
            foreignKeyName: "membership_permissions_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          id: string
          org_id: string
          role: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          org_id: string
          role: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          org_id?: string
          role?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      operations: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          name: string
          org_id: string
          slug: string
          status: string
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          org_id: string
          slug: string
          status?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          org_id?: string
          slug?: string
          status?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "operations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          status: string
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          status?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          status?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          updated_at: string
          user_id: string
          whatsapp_e164: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name: string
          updated_at?: string
          user_id: string
          whatsapp_e164?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          updated_at?: string
          user_id?: string
          whatsapp_e164?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
