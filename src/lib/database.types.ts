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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      contact_phones: {
        Row: {
          contact_id: string
          created_at: string
          e164: string
          id: string
          is_primary: boolean
          is_verified: boolean
          org_id: string
          original: string
          status: string
          updated_at: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          e164: string
          id?: string
          is_primary?: boolean
          is_verified?: boolean
          org_id: string
          original: string
          status?: string
          updated_at?: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          e164?: string
          id?: string
          is_primary?: boolean
          is_verified?: boolean
          org_id?: string
          original?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_phones_contact_id_org_id_fkey"
            columns: ["contact_id", "org_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "contact_phones_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          merged_into_contact_id: string | null
          name: string
          org_id: string
          preferences: Json
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          merged_into_contact_id?: string | null
          name: string
          org_id: string
          preferences?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          merged_into_contact_id?: string | null
          name?: string
          org_id?: string
          preferences?: Json
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_merged_into_contact_id_fkey"
            columns: ["merged_into_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
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
      lead_creation_requests: {
        Row: {
          actor_user_id: string
          ai_context: string | null
          assigned_membership_id: string | null
          authorization_confirmed: boolean
          contact_id: string | null
          created_at: string
          desired_action: string
          id: string
          internal_note: string | null
          name: string
          operation_id: string
          opportunity_id: string | null
          org_id: string
          phone_e164: string
          phone_original: string
          processed_at: string
          reused_contact: boolean
          reused_opportunity: boolean
          share_context_with_broker: boolean
          source: string
        }
        Insert: {
          actor_user_id?: string
          ai_context?: string | null
          assigned_membership_id?: string | null
          authorization_confirmed?: boolean
          contact_id?: string | null
          created_at?: string
          desired_action?: string
          id?: string
          internal_note?: string | null
          name: string
          operation_id: string
          opportunity_id?: string | null
          org_id: string
          phone_e164: string
          phone_original: string
          processed_at?: string
          reused_contact?: boolean
          reused_opportunity?: boolean
          share_context_with_broker?: boolean
          source?: string
        }
        Update: {
          actor_user_id?: string
          ai_context?: string | null
          assigned_membership_id?: string | null
          authorization_confirmed?: boolean
          contact_id?: string | null
          created_at?: string
          desired_action?: string
          id?: string
          internal_note?: string | null
          name?: string
          operation_id?: string
          opportunity_id?: string | null
          org_id?: string
          phone_e164?: string
          phone_original?: string
          processed_at?: string
          reused_contact?: boolean
          reused_opportunity?: boolean
          share_context_with_broker?: boolean
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_creation_requests_assigned_membership_id_org_id_fkey"
            columns: ["assigned_membership_id", "org_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "lead_creation_requests_contact_id_org_id_fkey"
            columns: ["contact_id", "org_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "lead_creation_requests_operation_id_org_id_fkey"
            columns: ["operation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "lead_creation_requests_opportunity_id_org_id_fkey"
            columns: ["opportunity_id", "org_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "lead_creation_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      loss_reasons: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          is_system: boolean
          name: string
          org_id: string
          parent_code: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          name: string
          org_id: string
          parent_code?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          name?: string
          org_id?: string
          parent_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loss_reasons_org_id_fkey"
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
      next_actions: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string
          due_at: string
          id: string
          operation_id: string
          opportunity_id: string
          org_id: string
          owner_membership_id: string
          status: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          due_at: string
          id?: string
          operation_id: string
          opportunity_id: string
          org_id: string
          owner_membership_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          due_at?: string
          id?: string
          operation_id?: string
          opportunity_id?: string
          org_id?: string
          owner_membership_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "next_actions_operation_id_org_id_fkey"
            columns: ["operation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "next_actions_opportunity_id_org_id_fkey"
            columns: ["opportunity_id", "org_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "next_actions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "next_actions_owner_membership_id_org_id_fkey"
            columns: ["owner_membership_id", "org_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id", "org_id"]
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
      opportunities: {
        Row: {
          ai_context: string | null
          assigned_membership_id: string | null
          contact_id: string
          created_at: string
          created_by: string | null
          current_conversation_id: string | null
          id: string
          internal_note: string | null
          last_activity_at: string
          operation_id: string
          org_id: string
          persona_code: string | null
          pipeline_stage_id: string
          share_context_with_broker: boolean
          source: string
          stage_entered_at: string
          status: string
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          ai_context?: string | null
          assigned_membership_id?: string | null
          contact_id: string
          created_at?: string
          created_by?: string | null
          current_conversation_id?: string | null
          id?: string
          internal_note?: string | null
          last_activity_at?: string
          operation_id: string
          org_id: string
          persona_code?: string | null
          pipeline_stage_id: string
          share_context_with_broker?: boolean
          source?: string
          stage_entered_at?: string
          status?: string
          title?: string
          updated_at?: string
          version?: number
        }
        Update: {
          ai_context?: string | null
          assigned_membership_id?: string | null
          contact_id?: string
          created_at?: string
          created_by?: string | null
          current_conversation_id?: string | null
          id?: string
          internal_note?: string | null
          last_activity_at?: string
          operation_id?: string
          org_id?: string
          persona_code?: string | null
          pipeline_stage_id?: string
          share_context_with_broker?: boolean
          source?: string
          stage_entered_at?: string
          status?: string
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_assigned_membership_id_org_id_fkey"
            columns: ["assigned_membership_id", "org_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "opportunities_contact_id_org_id_fkey"
            columns: ["contact_id", "org_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "opportunities_operation_id_org_id_fkey"
            columns: ["operation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "opportunities_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_pipeline_stage_id_org_id_fkey"
            columns: ["pipeline_stage_id", "org_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
      opportunity_participants: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          opportunity_id: string
          org_id: string
          role: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          id?: string
          opportunity_id: string
          org_id: string
          role?: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          opportunity_id?: string
          org_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_participants_contact_id_org_id_fkey"
            columns: ["contact_id", "org_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "opportunity_participants_opportunity_id_org_id_fkey"
            columns: ["opportunity_id", "org_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "opportunity_participants_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_scores: {
        Row: {
          created_at: string
          explanation: Json
          id: string
          opportunity_id: string
          org_id: string
          score: number
          source: string
        }
        Insert: {
          created_at?: string
          explanation?: Json
          id?: string
          opportunity_id: string
          org_id: string
          score: number
          source: string
        }
        Update: {
          created_at?: string
          explanation?: Json
          id?: string
          opportunity_id?: string
          org_id?: string
          score?: number
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_scores_opportunity_id_org_id_fkey"
            columns: ["opportunity_id", "org_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "opportunity_scores_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_stage_change_requests: {
        Row: {
          actor_user_id: string
          created_at: string
          expected_version: number
          id: string
          loss_reason_id: string | null
          next_action_description: string | null
          next_action_due_at: string | null
          opportunity_id: string
          org_id: string
          processed_at: string
          reason: string | null
          resulting_version: number | null
          sale_month: number | null
          sale_project_name: string | null
          sale_value: number | null
          sale_year: number | null
          target_stage_id: string
        }
        Insert: {
          actor_user_id?: string
          created_at?: string
          expected_version: number
          id?: string
          loss_reason_id?: string | null
          next_action_description?: string | null
          next_action_due_at?: string | null
          opportunity_id: string
          org_id: string
          processed_at?: string
          reason?: string | null
          resulting_version?: number | null
          sale_month?: number | null
          sale_project_name?: string | null
          sale_value?: number | null
          sale_year?: number | null
          target_stage_id: string
        }
        Update: {
          actor_user_id?: string
          created_at?: string
          expected_version?: number
          id?: string
          loss_reason_id?: string | null
          next_action_description?: string | null
          next_action_due_at?: string | null
          opportunity_id?: string
          org_id?: string
          processed_at?: string
          reason?: string | null
          resulting_version?: number | null
          sale_month?: number | null
          sale_project_name?: string | null
          sale_value?: number | null
          sale_year?: number | null
          target_stage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_stage_change_requests_loss_reason_id_org_id_fkey"
            columns: ["loss_reason_id", "org_id"]
            isOneToOne: false
            referencedRelation: "loss_reasons"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "opportunity_stage_change_requests_opportunity_id_org_id_fkey"
            columns: ["opportunity_id", "org_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "opportunity_stage_change_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_stage_change_requests_target_stage_id_org_id_fkey"
            columns: ["target_stage_id", "org_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
      opportunity_stage_history: {
        Row: {
          actor_type: string
          actor_user_id: string | null
          call_id: string | null
          created_at: string
          from_stage_id: string | null
          id: string
          operation_id: string
          opportunity_id: string
          opportunity_version: number
          org_id: string
          reason: string | null
          to_stage_id: string
        }
        Insert: {
          actor_type?: string
          actor_user_id?: string | null
          call_id?: string | null
          created_at?: string
          from_stage_id?: string | null
          id?: string
          operation_id: string
          opportunity_id: string
          opportunity_version: number
          org_id: string
          reason?: string | null
          to_stage_id: string
        }
        Update: {
          actor_type?: string
          actor_user_id?: string | null
          call_id?: string | null
          created_at?: string
          from_stage_id?: string | null
          id?: string
          operation_id?: string
          opportunity_id?: string
          opportunity_version?: number
          org_id?: string
          reason?: string | null
          to_stage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_stage_history_from_stage_id_org_id_fkey"
            columns: ["from_stage_id", "org_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "opportunity_stage_history_operation_id_org_id_fkey"
            columns: ["operation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "opportunity_stage_history_opportunity_id_org_id_fkey"
            columns: ["opportunity_id", "org_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "opportunity_stage_history_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_stage_history_to_stage_id_org_id_fkey"
            columns: ["to_stage_id", "org_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id", "org_id"]
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
      pipeline_stages: {
        Row: {
          category: string
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          org_id: string
          position: number
        }
        Insert: {
          category: string
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          org_id: string
          position: number
        }
        Update: {
          category?: string
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          org_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stages_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
      sales: {
        Row: {
          confirmed_at: string
          created_at: string
          created_by: string | null
          id: string
          operation_id: string
          opportunity_id: string
          org_id: string
          project_name: string | null
          responsible_membership_id: string | null
          sale_month: number
          sale_year: number
          status: string
          updated_at: string
          value: number | null
        }
        Insert: {
          confirmed_at?: string
          created_at?: string
          created_by?: string | null
          id?: string
          operation_id: string
          opportunity_id: string
          org_id: string
          project_name?: string | null
          responsible_membership_id?: string | null
          sale_month: number
          sale_year: number
          status?: string
          updated_at?: string
          value?: number | null
        }
        Update: {
          confirmed_at?: string
          created_at?: string
          created_by?: string | null
          id?: string
          operation_id?: string
          opportunity_id?: string
          org_id?: string
          project_name?: string | null
          responsible_membership_id?: string | null
          sale_month?: number
          sale_year?: number
          status?: string
          updated_at?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_operation_id_org_id_fkey"
            columns: ["operation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "sales_opportunity_id_org_id_fkey"
            columns: ["opportunity_id", "org_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "sales_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_responsible_membership_id_org_id_fkey"
            columns: ["responsible_membership_id", "org_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
      source_attributions: {
        Row: {
          attributed_at: string
          attribution_type: string
          campaign: string | null
          contact_id: string
          created_by: string | null
          external_reference: string | null
          id: string
          medium: string | null
          metadata: Json
          operation_id: string
          opportunity_id: string | null
          org_id: string
          source: string
        }
        Insert: {
          attributed_at?: string
          attribution_type: string
          campaign?: string | null
          contact_id: string
          created_by?: string | null
          external_reference?: string | null
          id?: string
          medium?: string | null
          metadata?: Json
          operation_id: string
          opportunity_id?: string | null
          org_id: string
          source: string
        }
        Update: {
          attributed_at?: string
          attribution_type?: string
          campaign?: string | null
          contact_id?: string
          created_by?: string | null
          external_reference?: string | null
          id?: string
          medium?: string | null
          metadata?: Json
          operation_id?: string
          opportunity_id?: string | null
          org_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_attributions_contact_id_org_id_fkey"
            columns: ["contact_id", "org_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "source_attributions_operation_id_org_id_fkey"
            columns: ["operation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "source_attributions_opportunity_id_org_id_fkey"
            columns: ["opportunity_id", "org_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "source_attributions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
