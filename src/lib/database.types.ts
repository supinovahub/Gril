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
      access_requests: {
        Row: {
          approval_expires_at: string | null
          approved_at: string | null
          approved_by: string | null
          approved_role: string | null
          approximate_brokers: number | null
          city: string | null
          cnpj: string | null
          consumed_at: string | null
          created_at: string
          creci: string | null
          email: string
          full_name: string
          id: string
          introduction: string | null
          last_submitted_at: string
          operation_description: string | null
          org_id: string | null
          organization_name: string | null
          public_reason: string | null
          request_type: string
          requested_role: string | null
          requester_user_id: string
          state: string | null
          status: string
          updated_at: string
          version: number
          whatsapp_e164: string
        }
        Insert: {
          approval_expires_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          approved_role?: string | null
          approximate_brokers?: number | null
          city?: string | null
          cnpj?: string | null
          consumed_at?: string | null
          created_at?: string
          creci?: string | null
          email: string
          full_name: string
          id?: string
          introduction?: string | null
          last_submitted_at?: string
          operation_description?: string | null
          org_id?: string | null
          organization_name?: string | null
          public_reason?: string | null
          request_type: string
          requested_role?: string | null
          requester_user_id: string
          state?: string | null
          status?: string
          updated_at?: string
          version?: number
          whatsapp_e164: string
        }
        Update: {
          approval_expires_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          approved_role?: string | null
          approximate_brokers?: number | null
          city?: string | null
          cnpj?: string | null
          consumed_at?: string | null
          created_at?: string
          creci?: string | null
          email?: string
          full_name?: string
          id?: string
          introduction?: string | null
          last_submitted_at?: string
          operation_description?: string | null
          org_id?: string | null
          organization_name?: string | null
          public_reason?: string | null
          request_type?: string
          requested_role?: string | null
          requester_user_id?: string
          state?: string | null
          status?: string
          updated_at?: string
          version?: number
          whatsapp_e164?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_action_executions: {
        Row: {
          action_input: Json
          action_type: string
          created_at: string
          error_redacted: string | null
          execution_id: string
          id: string
          org_id: string
          result: Json
          status: string
        }
        Insert: {
          action_input?: Json
          action_type: string
          created_at?: string
          error_redacted?: string | null
          execution_id: string
          id?: string
          org_id: string
          result?: Json
          status: string
        }
        Update: {
          action_input?: Json
          action_type?: string
          created_at?: string
          error_redacted?: string | null
          execution_id?: string
          id?: string
          org_id?: string
          result?: Json
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_action_executions_execution_id_org_id_fkey"
            columns: ["execution_id", "org_id"]
            isOneToOne: false
            referencedRelation: "ai_executions"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "ai_action_executions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_execution_requests: {
        Row: {
          actor_user_id: string | null
          conversation_id: string | null
          created_at: string
          execution_id: string | null
          expected_conversation_version: number | null
          id: string
          idempotency_key: string
          input_snapshot: Json
          mode: string
          operation_id: string | null
          org_id: string
          processed_at: string
          request_message_id: string | null
          result: string | null
        }
        Insert: {
          actor_user_id?: string | null
          conversation_id?: string | null
          created_at?: string
          execution_id?: string | null
          expected_conversation_version?: number | null
          id?: string
          idempotency_key: string
          input_snapshot?: Json
          mode: string
          operation_id?: string | null
          org_id: string
          processed_at?: string
          request_message_id?: string | null
          result?: string | null
        }
        Update: {
          actor_user_id?: string | null
          conversation_id?: string | null
          created_at?: string
          execution_id?: string | null
          expected_conversation_version?: number | null
          id?: string
          idempotency_key?: string
          input_snapshot?: Json
          mode?: string
          operation_id?: string | null
          org_id?: string
          processed_at?: string
          request_message_id?: string | null
          result?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_execution_requests_conversation_id_org_id_fkey"
            columns: ["conversation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "ai_execution_requests_conversation_id_org_id_fkey"
            columns: ["conversation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "inbox_notification_counts"
            referencedColumns: ["conversation_id", "org_id"]
          },
          {
            foreignKeyName: "ai_execution_requests_execution_id_org_id_fkey"
            columns: ["execution_id", "org_id"]
            isOneToOne: false
            referencedRelation: "ai_executions"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "ai_execution_requests_operation_id_org_id_fkey"
            columns: ["operation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "ai_execution_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_execution_requests_request_message_id_org_id_fkey"
            columns: ["request_message_id", "org_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
      ai_executions: {
        Row: {
          completed_at: string | null
          context_version_id: string | null
          conversation_id: string | null
          created_at: string
          error_code: string | null
          error_redacted: string | null
          estimated_cost: number | null
          expected_conversation_version: number | null
          id: string
          input_snapshot: Json
          input_tokens: number | null
          latency_ms: number | null
          mode: string
          model_profile_id: string | null
          model_returned: string | null
          operation_id: string | null
          org_id: string
          output_structured: Json | null
          output_text: string | null
          output_tokens: number | null
          request_message_id: string | null
          response_id: string | null
          started_at: string | null
          status: string
        }
        Insert: {
          completed_at?: string | null
          context_version_id?: string | null
          conversation_id?: string | null
          created_at?: string
          error_code?: string | null
          error_redacted?: string | null
          estimated_cost?: number | null
          expected_conversation_version?: number | null
          id?: string
          input_snapshot?: Json
          input_tokens?: number | null
          latency_ms?: number | null
          mode: string
          model_profile_id?: string | null
          model_returned?: string | null
          operation_id?: string | null
          org_id: string
          output_structured?: Json | null
          output_text?: string | null
          output_tokens?: number | null
          request_message_id?: string | null
          response_id?: string | null
          started_at?: string | null
          status?: string
        }
        Update: {
          completed_at?: string | null
          context_version_id?: string | null
          conversation_id?: string | null
          created_at?: string
          error_code?: string | null
          error_redacted?: string | null
          estimated_cost?: number | null
          expected_conversation_version?: number | null
          id?: string
          input_snapshot?: Json
          input_tokens?: number | null
          latency_ms?: number | null
          mode?: string
          model_profile_id?: string | null
          model_returned?: string | null
          operation_id?: string | null
          org_id?: string
          output_structured?: Json | null
          output_text?: string | null
          output_tokens?: number | null
          request_message_id?: string | null
          response_id?: string | null
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_executions_context_version_id_org_id_fkey"
            columns: ["context_version_id", "org_id"]
            isOneToOne: false
            referencedRelation: "conversation_context_versions"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "ai_executions_conversation_id_org_id_fkey"
            columns: ["conversation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "ai_executions_conversation_id_org_id_fkey"
            columns: ["conversation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "inbox_notification_counts"
            referencedColumns: ["conversation_id", "org_id"]
          },
          {
            foreignKeyName: "ai_executions_model_profile_id_org_id_fkey"
            columns: ["model_profile_id", "org_id"]
            isOneToOne: false
            referencedRelation: "model_profiles"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "ai_executions_operation_id_org_id_fkey"
            columns: ["operation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "ai_executions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_executions_request_message_id_org_id_fkey"
            columns: ["request_message_id", "org_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
      ai_suggestion_review_requests: {
        Row: {
          action: string
          actor_user_id: string
          created_at: string
          edited_body: string | null
          expected_conversation_version: number | null
          id: string
          message_id: string | null
          org_id: string
          processed_at: string
          result: string | null
          suggestion_id: string
        }
        Insert: {
          action: string
          actor_user_id?: string
          created_at?: string
          edited_body?: string | null
          expected_conversation_version?: number | null
          id?: string
          message_id?: string | null
          org_id: string
          processed_at?: string
          result?: string | null
          suggestion_id: string
        }
        Update: {
          action?: string
          actor_user_id?: string
          created_at?: string
          edited_body?: string | null
          expected_conversation_version?: number | null
          id?: string
          message_id?: string | null
          org_id?: string
          processed_at?: string
          result?: string | null
          suggestion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_suggestion_review_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_suggestion_review_requests_suggestion_id_org_id_fkey"
            columns: ["suggestion_id", "org_id"]
            isOneToOne: false
            referencedRelation: "ai_suggestions"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
      ai_suggestions: {
        Row: {
          body: string
          conversation_id: string | null
          created_at: string
          execution_id: string
          id: string
          org_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          body: string
          conversation_id?: string | null
          created_at?: string
          execution_id: string
          id?: string
          org_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          body?: string
          conversation_id?: string | null
          created_at?: string
          execution_id?: string
          id?: string
          org_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_suggestions_conversation_id_org_id_fkey"
            columns: ["conversation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "ai_suggestions_conversation_id_org_id_fkey"
            columns: ["conversation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "inbox_notification_counts"
            referencedColumns: ["conversation_id", "org_id"]
          },
          {
            foreignKeyName: "ai_suggestions_execution_id_org_id_fkey"
            columns: ["execution_id", "org_id"]
            isOneToOne: false
            referencedRelation: "ai_executions"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "ai_suggestions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_test_allowlist: {
        Row: {
          active: boolean
          created_at: string
          created_by: string
          id: string
          operation_id: string | null
          org_id: string
          phone_e164: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string
          id?: string
          operation_id?: string | null
          org_id: string
          phone_e164: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string
          id?: string
          operation_id?: string | null
          org_id?: string
          phone_e164?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_test_allowlist_operation_id_org_id_fkey"
            columns: ["operation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "ai_test_allowlist_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          body: string
          category: string
          created_at: string
          dedupe_key: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          operation_id: string | null
          org_id: string
          resolved_at: string | null
          severity: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          body: string
          category: string
          created_at?: string
          dedupe_key?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          operation_id?: string | null
          org_id: string
          resolved_at?: string | null
          severity: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          body?: string
          category?: string
          created_at?: string
          dedupe_key?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          operation_id?: string | null
          org_id?: string
          resolved_at?: string | null
          severity?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_operation_id_org_id_fkey"
            columns: ["operation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "alerts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      attachment_access_grants: {
        Row: {
          attachment_id: string
          created_at: string
          expires_at: string | null
          granted_by: string
          id: string
          membership_id: string
          org_id: string
          reason: string
          revoked_at: string | null
        }
        Insert: {
          attachment_id: string
          created_at?: string
          expires_at?: string | null
          granted_by: string
          id?: string
          membership_id: string
          org_id: string
          reason: string
          revoked_at?: string | null
        }
        Update: {
          attachment_id?: string
          created_at?: string
          expires_at?: string | null
          granted_by?: string
          id?: string
          membership_id?: string
          org_id?: string
          reason?: string
          revoked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attachment_access_grants_attachment_id_org_id_fkey"
            columns: ["attachment_id", "org_id"]
            isOneToOne: false
            referencedRelation: "attachments"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "attachment_access_grants_membership_id_org_id_fkey"
            columns: ["membership_id", "org_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "attachment_access_grants_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      attachments: {
        Row: {
          created_at: string
          id: string
          message_id: string
          mime_type: string | null
          org_id: string
          purge_after: string | null
          sensitivity: string
          sha256: string | null
          size_bytes: number | null
          storage_bucket: string
          storage_path: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_id: string
          mime_type?: string | null
          org_id: string
          purge_after?: string | null
          sensitivity?: string
          sha256?: string | null
          size_bytes?: number | null
          storage_bucket: string
          storage_path: string
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string
          mime_type?: string | null
          org_id?: string
          purge_after?: string | null
          sensitivity?: string
          sha256?: string | null
          size_bytes?: number | null
          storage_bucket?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "attachments_message_id_org_id_fkey"
            columns: ["message_id", "org_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "attachments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_exceptions: {
        Row: {
          availability: string
          created_at: string
          created_by: string | null
          ends_at: string
          id: string
          membership_id: string
          operation_id: string
          org_id: string
          reason: string | null
          starts_at: string
        }
        Insert: {
          availability: string
          created_at?: string
          created_by?: string | null
          ends_at: string
          id?: string
          membership_id: string
          operation_id: string
          org_id: string
          reason?: string | null
          starts_at: string
        }
        Update: {
          availability?: string
          created_at?: string
          created_by?: string | null
          ends_at?: string
          id?: string
          membership_id?: string
          operation_id?: string
          org_id?: string
          reason?: string | null
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_exceptions_membership_id_org_id_fkey"
            columns: ["membership_id", "org_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "availability_exceptions_operation_id_org_id_fkey"
            columns: ["operation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "availability_exceptions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_rules: {
        Row: {
          active: boolean
          capacity: number
          created_at: string
          end_time: string
          id: string
          membership_id: string
          operation_id: string
          org_id: string
          start_time: string
          timezone: string
          updated_at: string
          valid_from: string
          valid_until: string | null
          weekday: number
        }
        Insert: {
          active?: boolean
          capacity?: number
          created_at?: string
          end_time: string
          id?: string
          membership_id: string
          operation_id: string
          org_id: string
          start_time: string
          timezone?: string
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
          weekday: number
        }
        Update: {
          active?: boolean
          capacity?: number
          created_at?: string
          end_time?: string
          id?: string
          membership_id?: string
          operation_id?: string
          org_id?: string
          start_time?: string
          timezone?: string
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "availability_rules_membership_id_org_id_fkey"
            columns: ["membership_id", "org_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "availability_rules_operation_id_org_id_fkey"
            columns: ["operation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "availability_rules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_alerts: {
        Row: {
          budget: number
          created_at: string
          current_cost: number
          id: string
          org_id: string
          period_start: string
          status: string
          threshold_percent: number
        }
        Insert: {
          budget: number
          created_at?: string
          current_cost: number
          id?: string
          org_id: string
          period_start: string
          status?: string
          threshold_percent: number
        }
        Update: {
          budget?: number
          created_at?: string
          current_cost?: number
          id?: string
          org_id?: string
          period_start?: string
          status?: string
          threshold_percent?: number
        }
        Relationships: [
          {
            foreignKeyName: "budget_alerts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      call_assignments: {
        Row: {
          active: boolean
          assigned_at: string
          assigned_by: string | null
          assignment_type: string
          call_id: string
          id: string
          membership_id: string
          offer_id: string | null
          org_id: string
          revocation_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
        }
        Insert: {
          active?: boolean
          assigned_at?: string
          assigned_by?: string | null
          assignment_type: string
          call_id: string
          id?: string
          membership_id: string
          offer_id?: string | null
          org_id: string
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
        }
        Update: {
          active?: boolean
          assigned_at?: string
          assigned_by?: string | null
          assignment_type?: string
          call_id?: string
          id?: string
          membership_id?: string
          offer_id?: string | null
          org_id?: string
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_assignments_call_id_org_id_fkey"
            columns: ["call_id", "org_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "call_assignments_membership_id_org_id_fkey"
            columns: ["membership_id", "org_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "call_assignments_offer_id_org_id_fkey"
            columns: ["offer_id", "org_id"]
            isOneToOne: false
            referencedRelation: "call_offers"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "call_assignments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      call_creation_requests: {
        Row: {
          actor_user_id: string | null
          call_id: string | null
          created_at: string
          expected_opportunity_version: number
          format: string
          id: string
          lead_confirmed: boolean
          operation_id: string
          opportunity_id: string
          org_id: string
          processed_at: string
          result: string | null
          starts_at: string
        }
        Insert: {
          actor_user_id?: string | null
          call_id?: string | null
          created_at?: string
          expected_opportunity_version: number
          format: string
          id?: string
          lead_confirmed: boolean
          operation_id: string
          opportunity_id: string
          org_id: string
          processed_at?: string
          result?: string | null
          starts_at: string
        }
        Update: {
          actor_user_id?: string | null
          call_id?: string | null
          created_at?: string
          expected_opportunity_version?: number
          format?: string
          id?: string
          lead_confirmed?: boolean
          operation_id?: string
          opportunity_id?: string
          org_id?: string
          processed_at?: string
          result?: string | null
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_creation_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      call_distribution_requests: {
        Row: {
          actor_user_id: string | null
          call_id: string
          created_at: string
          id: string
          offer_count: number
          org_id: string
          processed_at: string
          result: string | null
        }
        Insert: {
          actor_user_id?: string | null
          call_id: string
          created_at?: string
          id?: string
          offer_count?: number
          org_id: string
          processed_at?: string
          result?: string | null
        }
        Update: {
          actor_user_id?: string | null
          call_id?: string
          created_at?: string
          id?: string
          offer_count?: number
          org_id?: string
          processed_at?: string
          result?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_distribution_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      call_holds: {
        Row: {
          created_at: string
          created_by: string | null
          ends_at: string
          expires_at: string
          id: string
          lead_confirmed: boolean
          operation_id: string
          opportunity_id: string
          org_id: string
          preferred_format: string
          starts_at: string
          status: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ends_at: string
          expires_at: string
          id?: string
          lead_confirmed?: boolean
          operation_id: string
          opportunity_id: string
          org_id: string
          preferred_format?: string
          starts_at: string
          status?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ends_at?: string
          expires_at?: string
          id?: string
          lead_confirmed?: boolean
          operation_id?: string
          opportunity_id?: string
          org_id?: string
          preferred_format?: string
          starts_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_holds_operation_id_org_id_fkey"
            columns: ["operation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "call_holds_opportunity_id_org_id_fkey"
            columns: ["opportunity_id", "org_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "call_holds_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      call_offer_accept_requests: {
        Row: {
          actor_user_id: string
          assignment_id: string | null
          call_id: string
          created_at: string
          expected_call_version: number
          id: string
          offer_id: string
          org_id: string
          processed_at: string
          result: string | null
        }
        Insert: {
          actor_user_id?: string
          assignment_id?: string | null
          call_id: string
          created_at?: string
          expected_call_version: number
          id?: string
          offer_id: string
          org_id: string
          processed_at?: string
          result?: string | null
        }
        Update: {
          actor_user_id?: string
          assignment_id?: string | null
          call_id?: string
          created_at?: string
          expected_call_version?: number
          id?: string
          offer_id?: string
          org_id?: string
          processed_at?: string
          result?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_offer_accept_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      call_offer_response_requests: {
        Row: {
          action: string
          actor_user_id: string
          call_id: string
          created_at: string
          id: string
          offer_id: string | null
          org_id: string
          processed_at: string
          result: Json | null
        }
        Insert: {
          action: string
          actor_user_id?: string
          call_id: string
          created_at?: string
          id?: string
          offer_id?: string | null
          org_id: string
          processed_at?: string
          result?: Json | null
        }
        Update: {
          action?: string
          actor_user_id?: string
          call_id?: string
          created_at?: string
          id?: string
          offer_id?: string | null
          org_id?: string
          processed_at?: string
          result?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "call_offer_response_requests_call_id_org_id_fkey"
            columns: ["call_id", "org_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "call_offer_response_requests_offer_id_org_id_fkey"
            columns: ["offer_id", "org_id"]
            isOneToOne: false
            referencedRelation: "call_offers"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "call_offer_response_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      call_offers: {
        Row: {
          call_id: string
          created_at: string
          expires_at: string
          id: string
          offer_type: string
          org_id: string
          provider_response: Json | null
          recipient_membership_id: string
          responded_at: string | null
          round: number
          sent_at: string | null
          status: string
        }
        Insert: {
          call_id: string
          created_at?: string
          expires_at: string
          id?: string
          offer_type: string
          org_id: string
          provider_response?: Json | null
          recipient_membership_id: string
          responded_at?: string | null
          round: number
          sent_at?: string | null
          status?: string
        }
        Update: {
          call_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          offer_type?: string
          org_id?: string
          provider_response?: Json | null
          recipient_membership_id?: string
          responded_at?: string | null
          round?: number
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_offers_call_id_org_id_fkey"
            columns: ["call_id", "org_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "call_offers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_offers_recipient_membership_id_org_id_fkey"
            columns: ["recipient_membership_id", "org_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
      call_result_requests: {
        Row: {
          actor_user_id: string
          call_id: string
          call_result_id: string | null
          context: string | null
          created_at: string
          expected_call_version: number
          id: string
          next_action: string | null
          next_action_due_at: string | null
          org_id: string
          processed_at: string
          purchase_month: number | null
          purchase_year: number | null
          reason: string | null
          result: string
        }
        Insert: {
          actor_user_id?: string
          call_id: string
          call_result_id?: string | null
          context?: string | null
          created_at?: string
          expected_call_version: number
          id?: string
          next_action?: string | null
          next_action_due_at?: string | null
          org_id: string
          processed_at?: string
          purchase_month?: number | null
          purchase_year?: number | null
          reason?: string | null
          result: string
        }
        Update: {
          actor_user_id?: string
          call_id?: string
          call_result_id?: string | null
          context?: string | null
          created_at?: string
          expected_call_version?: number
          id?: string
          next_action?: string | null
          next_action_due_at?: string | null
          org_id?: string
          processed_at?: string
          purchase_month?: number | null
          purchase_year?: number | null
          reason?: string | null
          result?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_result_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      call_results: {
        Row: {
          call_id: string
          context: string | null
          id: string
          next_action: string | null
          next_action_due_at: string | null
          org_id: string
          purchase_month: number | null
          purchase_year: number | null
          reason: string | null
          recorded_at: string
          recorded_by: string
          result: string
        }
        Insert: {
          call_id: string
          context?: string | null
          id?: string
          next_action?: string | null
          next_action_due_at?: string | null
          org_id: string
          purchase_month?: number | null
          purchase_year?: number | null
          reason?: string | null
          recorded_at?: string
          recorded_by: string
          result: string
        }
        Update: {
          call_id?: string
          context?: string | null
          id?: string
          next_action?: string | null
          next_action_due_at?: string | null
          org_id?: string
          purchase_month?: number | null
          purchase_year?: number | null
          reason?: string | null
          recorded_at?: string
          recorded_by?: string
          result?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_results_call_id_org_id_fkey"
            columns: ["call_id", "org_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "call_results_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      call_settings_requests: {
        Row: {
          actor_user_id: string
          can_receive_calls: boolean
          created_at: string
          id: string
          is_preferred_receiver: boolean
          membership_id: string
          operation_id: string
          org_id: string
          processed_at: string
          receive_urgent_call_alerts: boolean
        }
        Insert: {
          actor_user_id?: string
          can_receive_calls: boolean
          created_at?: string
          id?: string
          is_preferred_receiver?: boolean
          membership_id: string
          operation_id: string
          org_id: string
          processed_at?: string
          receive_urgent_call_alerts?: boolean
        }
        Update: {
          actor_user_id?: string
          can_receive_calls?: boolean
          created_at?: string
          id?: string
          is_preferred_receiver?: boolean
          membership_id?: string
          operation_id?: string
          org_id?: string
          processed_at?: string
          receive_urgent_call_alerts?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "call_settings_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      call_video_link_requests: {
        Row: {
          actor_user_id: string
          call_id: string
          created_at: string
          expected_call_version: number
          id: string
          org_id: string
          processed_at: string
          result: string | null
          video_link: string
        }
        Insert: {
          actor_user_id?: string
          call_id: string
          created_at?: string
          expected_call_version: number
          id?: string
          org_id: string
          processed_at?: string
          result?: string | null
          video_link: string
        }
        Update: {
          actor_user_id?: string
          call_id?: string
          created_at?: string
          expected_call_version?: number
          id?: string
          org_id?: string
          processed_at?: string
          result?: string | null
          video_link?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_video_link_requests_call_id_org_id_fkey"
            columns: ["call_id", "org_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "call_video_link_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      calls: {
        Row: {
          assigned_membership_id: string | null
          blocked_until: string
          completed_at: string | null
          created_at: string
          ends_at: string
          format: string
          hold_id: string
          id: string
          nominal_membership_id: string | null
          nominal_substitution_allowed: boolean
          operation_id: string
          opportunity_id: string
          org_id: string
          preferred_round_completed: boolean
          reschedule_count: number
          starts_at: string
          status: string
          updated_at: string
          version: number
          video_link: string | null
        }
        Insert: {
          assigned_membership_id?: string | null
          blocked_until: string
          completed_at?: string | null
          created_at?: string
          ends_at: string
          format?: string
          hold_id: string
          id?: string
          nominal_membership_id?: string | null
          nominal_substitution_allowed?: boolean
          operation_id: string
          opportunity_id: string
          org_id: string
          preferred_round_completed?: boolean
          reschedule_count?: number
          starts_at: string
          status?: string
          updated_at?: string
          version?: number
          video_link?: string | null
        }
        Update: {
          assigned_membership_id?: string | null
          blocked_until?: string
          completed_at?: string | null
          created_at?: string
          ends_at?: string
          format?: string
          hold_id?: string
          id?: string
          nominal_membership_id?: string | null
          nominal_substitution_allowed?: boolean
          operation_id?: string
          opportunity_id?: string
          org_id?: string
          preferred_round_completed?: boolean
          reschedule_count?: number
          starts_at?: string
          status?: string
          updated_at?: string
          version?: number
          video_link?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calls_assigned_membership_id_org_id_fkey"
            columns: ["assigned_membership_id", "org_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "calls_hold_id_org_id_fkey"
            columns: ["hold_id", "org_id"]
            isOneToOne: false
            referencedRelation: "call_holds"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "calls_nominal_membership_id_org_id_fkey"
            columns: ["nominal_membership_id", "org_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "calls_operation_id_org_id_fkey"
            columns: ["operation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "calls_opportunity_id_org_id_fkey"
            columns: ["opportunity_id", "org_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "calls_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_contacts: {
        Row: {
          attempts: number
          campaign_id: string
          contact_id: string
          created_at: string
          id: string
          import_row_id: string | null
          last_revalidated_at: string | null
          next_send_at: string | null
          opportunity_id: string
          org_id: string
          priority: number
          status: string
          suppression_reason: string | null
          updated_at: string
          variant: string | null
          wave_id: string | null
        }
        Insert: {
          attempts?: number
          campaign_id: string
          contact_id: string
          created_at?: string
          id?: string
          import_row_id?: string | null
          last_revalidated_at?: string | null
          next_send_at?: string | null
          opportunity_id: string
          org_id: string
          priority?: number
          status?: string
          suppression_reason?: string | null
          updated_at?: string
          variant?: string | null
          wave_id?: string | null
        }
        Update: {
          attempts?: number
          campaign_id?: string
          contact_id?: string
          created_at?: string
          id?: string
          import_row_id?: string | null
          last_revalidated_at?: string | null
          next_send_at?: string | null
          opportunity_id?: string
          org_id?: string
          priority?: number
          status?: string
          suppression_reason?: string | null
          updated_at?: string
          variant?: string | null
          wave_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_contacts_campaign_id_org_id_fkey"
            columns: ["campaign_id", "org_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "campaign_contacts_contact_id_org_id_fkey"
            columns: ["contact_id", "org_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "campaign_contacts_import_row_id_org_id_fkey"
            columns: ["import_row_id", "org_id"]
            isOneToOne: false
            referencedRelation: "campaign_import_rows"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "campaign_contacts_opportunity_id_org_id_fkey"
            columns: ["opportunity_id", "org_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "campaign_contacts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_contacts_wave_id_org_id_fkey"
            columns: ["wave_id", "org_id"]
            isOneToOne: false
            referencedRelation: "campaign_waves"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
      campaign_creation_requests: {
        Row: {
          actor_user_id: string
          ai_mode: string
          campaign_id: string | null
          connection_id: string
          consent_source: string
          consent_statement: string
          created_at: string
          id: string
          message_template_id: string | null
          name: string
          opening_template: string
          operation_id: string
          org_id: string
          processed_at: string
        }
        Insert: {
          actor_user_id?: string
          ai_mode: string
          campaign_id?: string | null
          connection_id: string
          consent_source: string
          consent_statement: string
          created_at?: string
          id?: string
          message_template_id?: string | null
          name: string
          opening_template: string
          operation_id: string
          org_id: string
          processed_at?: string
        }
        Update: {
          actor_user_id?: string
          ai_mode?: string
          campaign_id?: string | null
          connection_id?: string
          consent_source?: string
          consent_statement?: string
          created_at?: string
          id?: string
          message_template_id?: string | null
          name?: string
          opening_template?: string
          operation_id?: string
          org_id?: string
          processed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_creation_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_import_requests: {
        Row: {
          actor_user_id: string
          campaign_id: string
          created_at: string
          duplicate_rows: number
          error_rows: number
          file_sha256: string | null
          filename: string
          id: string
          import_id: string | null
          mapping: Json
          org_id: string
          processed_at: string
          rows: Json
          valid_rows: number
        }
        Insert: {
          actor_user_id?: string
          campaign_id: string
          created_at?: string
          duplicate_rows?: number
          error_rows?: number
          file_sha256?: string | null
          filename: string
          id?: string
          import_id?: string | null
          mapping?: Json
          org_id: string
          processed_at?: string
          rows: Json
          valid_rows?: number
        }
        Update: {
          actor_user_id?: string
          campaign_id?: string
          created_at?: string
          duplicate_rows?: number
          error_rows?: number
          file_sha256?: string | null
          filename?: string
          id?: string
          import_id?: string | null
          mapping?: Json
          org_id?: string
          processed_at?: string
          rows?: Json
          valid_rows?: number
        }
        Relationships: [
          {
            foreignKeyName: "campaign_import_requests_campaign_id_org_id_fkey"
            columns: ["campaign_id", "org_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "campaign_import_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_import_rows: {
        Row: {
          contact_id: string | null
          created_at: string
          error_code: string | null
          id: string
          import_id: string
          normalized_name: string | null
          normalized_phone: string | null
          opportunity_id: string | null
          org_id: string
          raw_data: Json
          row_number: number
          status: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          error_code?: string | null
          id?: string
          import_id: string
          normalized_name?: string | null
          normalized_phone?: string | null
          opportunity_id?: string | null
          org_id: string
          raw_data: Json
          row_number: number
          status: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          error_code?: string | null
          id?: string
          import_id?: string
          normalized_name?: string | null
          normalized_phone?: string | null
          opportunity_id?: string | null
          org_id?: string
          raw_data?: Json
          row_number?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_import_rows_contact_id_org_id_fkey"
            columns: ["contact_id", "org_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "campaign_import_rows_import_id_org_id_fkey"
            columns: ["import_id", "org_id"]
            isOneToOne: false
            referencedRelation: "campaign_imports"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "campaign_import_rows_opportunity_id_org_id_fkey"
            columns: ["opportunity_id", "org_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "campaign_import_rows_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_imports: {
        Row: {
          campaign_id: string
          completed_at: string | null
          created_at: string
          duplicate_rows: number
          error_rows: number
          file_sha256: string | null
          filename: string
          id: string
          imported_by: string
          mapping: Json
          org_id: string
          status: string
          total_rows: number
          valid_rows: number
        }
        Insert: {
          campaign_id: string
          completed_at?: string | null
          created_at?: string
          duplicate_rows?: number
          error_rows?: number
          file_sha256?: string | null
          filename: string
          id?: string
          imported_by: string
          mapping?: Json
          org_id: string
          status?: string
          total_rows?: number
          valid_rows?: number
        }
        Update: {
          campaign_id?: string
          completed_at?: string | null
          created_at?: string
          duplicate_rows?: number
          error_rows?: number
          file_sha256?: string | null
          filename?: string
          id?: string
          imported_by?: string
          mapping?: Json
          org_id?: string
          status?: string
          total_rows?: number
          valid_rows?: number
        }
        Relationships: [
          {
            foreignKeyName: "campaign_imports_campaign_id_org_id_fkey"
            columns: ["campaign_id", "org_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "campaign_imports_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_transition_requests: {
        Row: {
          actor_user_id: string
          campaign_id: string
          created_at: string
          expected_version: number
          id: string
          org_id: string
          processed_at: string
          reason: string | null
          requested_action: string
          resulting_status: string | null
        }
        Insert: {
          actor_user_id?: string
          campaign_id: string
          created_at?: string
          expected_version: number
          id?: string
          org_id: string
          processed_at?: string
          reason?: string | null
          requested_action: string
          resulting_status?: string | null
        }
        Update: {
          actor_user_id?: string
          campaign_id?: string
          created_at?: string
          expected_version?: number
          id?: string
          org_id?: string
          processed_at?: string
          reason?: string | null
          requested_action?: string
          resulting_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_transition_requests_campaign_id_org_id_fkey"
            columns: ["campaign_id", "org_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "campaign_transition_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_wave_contact_reviews: {
        Row: {
          campaign_contact_id: string
          campaign_id: string
          created_at: string
          id: string
          notes: string | null
          org_id: string
          outcome: string
          required_for_gate: boolean
          reviewed_at: string | null
          reviewed_by: string | null
          updated_at: string
          wave_id: string
        }
        Insert: {
          campaign_contact_id: string
          campaign_id: string
          created_at?: string
          id?: string
          notes?: string | null
          org_id: string
          outcome?: string
          required_for_gate?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          updated_at?: string
          wave_id: string
        }
        Update: {
          campaign_contact_id?: string
          campaign_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          org_id?: string
          outcome?: string
          required_for_gate?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          updated_at?: string
          wave_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_wave_contact_reviews_campaign_contact_id_org_id_fkey"
            columns: ["campaign_contact_id", "org_id"]
            isOneToOne: false
            referencedRelation: "campaign_contacts"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "campaign_wave_contact_reviews_campaign_id_org_id_fkey"
            columns: ["campaign_id", "org_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "campaign_wave_contact_reviews_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_wave_contact_reviews_wave_id_org_id_fkey"
            columns: ["wave_id", "org_id"]
            isOneToOne: false
            referencedRelation: "campaign_waves"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
      campaign_wave_release_requests: {
        Row: {
          actor_user_id: string
          campaign_id: string
          created_at: string
          id: string
          org_id: string
          processed_at: string
          released_count: number
          requested_count: number
          suppressed_count: number
          wave_id: string | null
        }
        Insert: {
          actor_user_id?: string
          campaign_id: string
          created_at?: string
          id?: string
          org_id: string
          processed_at?: string
          released_count?: number
          requested_count: number
          suppressed_count?: number
          wave_id?: string | null
        }
        Update: {
          actor_user_id?: string
          campaign_id?: string
          created_at?: string
          id?: string
          org_id?: string
          processed_at?: string
          released_count?: number
          requested_count?: number
          suppressed_count?: number
          wave_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_wave_release_requests_campaign_id_org_id_fkey"
            columns: ["campaign_id", "org_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "campaign_wave_release_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_wave_review_requests: {
        Row: {
          actor_user_id: string
          created_at: string
          id: string
          notes: string | null
          org_id: string
          outcome: string | null
          processed_at: string
          requested_action: string
          resulting_status: string | null
          review_id: string | null
          wave_id: string
        }
        Insert: {
          actor_user_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          org_id: string
          outcome?: string | null
          processed_at?: string
          requested_action: string
          resulting_status?: string | null
          review_id?: string | null
          wave_id: string
        }
        Update: {
          actor_user_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          org_id?: string
          outcome?: string | null
          processed_at?: string
          requested_action?: string
          resulting_status?: string | null
          review_id?: string | null
          wave_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_wave_review_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_wave_review_requests_review_id_org_id_fkey"
            columns: ["review_id", "org_id"]
            isOneToOne: false
            referencedRelation: "campaign_wave_contact_reviews"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "campaign_wave_review_requests_wave_id_org_id_fkey"
            columns: ["wave_id", "org_id"]
            isOneToOne: false
            referencedRelation: "campaign_waves"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
      campaign_waves: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          campaign_id: string
          created_at: string
          id: string
          metrics: Json
          org_id: string
          released_at: string | null
          released_count: number
          requested_count: number
          review_completed_count: number
          review_critical_count: number
          review_required_count: number
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          suppressed_count: number
          wave_number: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          campaign_id: string
          created_at?: string
          id?: string
          metrics?: Json
          org_id: string
          released_at?: string | null
          released_count?: number
          requested_count: number
          review_completed_count?: number
          review_critical_count?: number
          review_required_count?: number
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          suppressed_count?: number
          wave_number: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          campaign_id?: string
          created_at?: string
          id?: string
          metrics?: Json
          org_id?: string
          released_at?: string | null
          released_count?: number
          requested_count?: number
          review_completed_count?: number
          review_critical_count?: number
          review_required_count?: number
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          suppressed_count?: number
          wave_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "campaign_waves_campaign_id_org_id_fkey"
            columns: ["campaign_id", "org_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "campaign_waves_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          ai_mode: string
          approved_at: string | null
          approved_by: string | null
          campaign_type: string
          completed_at: string | null
          connection_id: string
          consent_declaration_id: string
          created_at: string
          created_by: string
          id: string
          max_contacts: number
          message_template_id: string | null
          name: string
          opening_examples: Json
          opening_template: string
          operation_id: string
          org_id: string
          paused_reason: string | null
          priority: number
          send_window_end: string
          send_window_start: string
          status: string
          timezone: string
          updated_at: string
          version: number
        }
        Insert: {
          ai_mode?: string
          approved_at?: string | null
          approved_by?: string | null
          campaign_type?: string
          completed_at?: string | null
          connection_id: string
          consent_declaration_id: string
          created_at?: string
          created_by: string
          id?: string
          max_contacts?: number
          message_template_id?: string | null
          name: string
          opening_examples?: Json
          opening_template: string
          operation_id: string
          org_id: string
          paused_reason?: string | null
          priority?: number
          send_window_end?: string
          send_window_start?: string
          status?: string
          timezone?: string
          updated_at?: string
          version?: number
        }
        Update: {
          ai_mode?: string
          approved_at?: string | null
          approved_by?: string | null
          campaign_type?: string
          completed_at?: string | null
          connection_id?: string
          consent_declaration_id?: string
          created_at?: string
          created_by?: string
          id?: string
          max_contacts?: number
          message_template_id?: string | null
          name?: string
          opening_examples?: Json
          opening_template?: string
          operation_id?: string
          org_id?: string
          paused_reason?: string | null
          priority?: number
          send_window_end?: string
          send_window_start?: string
          status?: string
          timezone?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_connection_id_org_id_fkey"
            columns: ["connection_id", "org_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_connections"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "campaigns_consent_declaration_id_org_id_fkey"
            columns: ["consent_declaration_id", "org_id"]
            isOneToOne: false
            referencedRelation: "consent_declarations"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "campaigns_message_template_id_org_id_fkey"
            columns: ["message_template_id", "org_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_message_templates"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "campaigns_operation_id_org_id_fkey"
            columns: ["operation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "campaigns_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      capacity_reservation_requests: {
        Row: {
          action: string
          active_count: number | null
          conversation_id: string
          created_at: string
          id: string
          operation_id: string
          org_id: string
          processed_at: string
          result: string | null
          source: string
        }
        Insert: {
          action: string
          active_count?: number | null
          conversation_id: string
          created_at?: string
          id?: string
          operation_id: string
          org_id: string
          processed_at?: string
          result?: string | null
          source: string
        }
        Update: {
          action?: string
          active_count?: number | null
          conversation_id?: string
          created_at?: string
          id?: string
          operation_id?: string
          org_id?: string
          processed_at?: string
          result?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "capacity_reservation_requests_conversation_id_org_id_fkey"
            columns: ["conversation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "capacity_reservation_requests_conversation_id_org_id_fkey"
            columns: ["conversation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "inbox_notification_counts"
            referencedColumns: ["conversation_id", "org_id"]
          },
          {
            foreignKeyName: "capacity_reservation_requests_operation_id_org_id_fkey"
            columns: ["operation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "capacity_reservation_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      capacity_snapshots: {
        Row: {
          active_count: number
          backlog_count: number
          captured_at: string
          id: number
          operation_id: string
          org_id: string
          proactive_paused: boolean
        }
        Insert: {
          active_count: number
          backlog_count?: number
          captured_at?: string
          id?: never
          operation_id: string
          org_id: string
          proactive_paused: boolean
        }
        Update: {
          active_count?: number
          backlog_count?: number
          captured_at?: string
          id?: never
          operation_id?: string
          org_id?: string
          proactive_paused?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "capacity_snapshots_operation_id_org_id_fkey"
            columns: ["operation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "capacity_snapshots_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_items: {
        Row: {
          created_at: string
          id: string
          label: string
          org_id: string
          position: number
          required: boolean
          template_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          org_id: string
          position: number
          required?: boolean
          template_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          org_id?: string
          position?: number
          required?: boolean
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_items_template_id_org_id_fkey"
            columns: ["template_id", "org_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
      checklist_template_requests: {
        Row: {
          actor_user_id: string
          created_at: string
          id: string
          items: Json
          name: string
          operation_id: string
          org_id: string
          processed_at: string
          result: string | null
          stage_code: string
          template_id: string | null
        }
        Insert: {
          actor_user_id?: string
          created_at?: string
          id?: string
          items: Json
          name: string
          operation_id: string
          org_id: string
          processed_at?: string
          result?: string | null
          stage_code: string
          template_id?: string | null
        }
        Update: {
          actor_user_id?: string
          created_at?: string
          id?: string
          items?: Json
          name?: string
          operation_id?: string
          org_id?: string
          processed_at?: string
          result?: string | null
          stage_code?: string
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_template_requests_operation_id_org_id_fkey"
            columns: ["operation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "checklist_template_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_templates: {
        Row: {
          created_at: string
          id: string
          name: string
          operation_id: string
          org_id: string
          stage_code: string
          status: string
          version: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          operation_id: string
          org_id: string
          stage_code: string
          status?: string
          version?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          operation_id?: string
          org_id?: string
          stage_code?: string
          status?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "checklist_templates_operation_id_org_id_fkey"
            columns: ["operation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "checklist_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_update_requests: {
        Row: {
          action: string
          actor_user_id: string
          created_at: string
          id: string
          item_id: string
          note: string | null
          opportunity_checklist_id: string
          org_id: string
          processed_at: string
        }
        Insert: {
          action: string
          actor_user_id?: string
          created_at?: string
          id?: string
          item_id: string
          note?: string | null
          opportunity_checklist_id: string
          org_id: string
          processed_at?: string
        }
        Update: {
          action?: string
          actor_user_id?: string
          created_at?: string
          id?: string
          item_id?: string
          note?: string | null
          opportunity_checklist_id?: string
          org_id?: string
          processed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_update_requests_opportunity_checklist_id_fkey"
            columns: ["opportunity_checklist_id"]
            isOneToOne: false
            referencedRelation: "opportunity_checklists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_update_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_waivers: {
        Row: {
          created_at: string
          id: string
          item_code: string
          opportunity_checklist_id: string
          org_id: string
          reason: string
          waived_by: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_code: string
          opportunity_checklist_id: string
          org_id: string
          reason: string
          waived_by?: string
        }
        Update: {
          created_at?: string
          id?: string
          item_code?: string
          opportunity_checklist_id?: string
          org_id?: string
          reason?: string
          waived_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_waivers_opportunity_checklist_id_fkey"
            columns: ["opportunity_checklist_id"]
            isOneToOne: false
            referencedRelation: "opportunity_checklists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_waivers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      connection_activation_requests: {
        Row: {
          action: string
          actor_user_id: string
          campaign_enabled: boolean
          connection_id: string
          created_at: string
          id: string
          inbound_enabled: boolean
          org_id: string
          processed_at: string
          reason: string | null
          resulting_status: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string
          campaign_enabled?: boolean
          connection_id: string
          created_at?: string
          id?: string
          inbound_enabled?: boolean
          org_id: string
          processed_at?: string
          reason?: string | null
          resulting_status?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string
          campaign_enabled?: boolean
          connection_id?: string
          created_at?: string
          id?: string
          inbound_enabled?: boolean
          org_id?: string
          processed_at?: string
          reason?: string | null
          resulting_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "connection_activation_requests_connection_id_org_id_fkey"
            columns: ["connection_id", "org_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_connections"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "connection_activation_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_declarations: {
        Row: {
          confirmed_at: string
          confirmed_by: string
          created_at: string
          id: string
          operation_id: string
          org_id: string
          revoked_at: string | null
          source_description: string
          statement_text: string
          statement_version: number
        }
        Insert: {
          confirmed_at?: string
          confirmed_by: string
          created_at?: string
          id?: string
          operation_id: string
          org_id: string
          revoked_at?: string | null
          source_description: string
          statement_text: string
          statement_version?: number
        }
        Update: {
          confirmed_at?: string
          confirmed_by?: string
          created_at?: string
          id?: string
          operation_id?: string
          org_id?: string
          revoked_at?: string | null
          source_description?: string
          statement_text?: string
          statement_version?: number
        }
        Relationships: [
          {
            foreignKeyName: "consent_declarations_operation_id_org_id_fkey"
            columns: ["operation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "consent_declarations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_archive_requests: {
        Row: {
          action: string
          actor_user_id: string
          contact_id: string
          created_at: string
          id: string
          org_id: string
          processed_at: string
          reason: string
          result: string | null
          resume_mode: string
        }
        Insert: {
          action: string
          actor_user_id?: string
          contact_id: string
          created_at?: string
          id?: string
          org_id: string
          processed_at?: string
          reason: string
          result?: string | null
          resume_mode?: string
        }
        Update: {
          action?: string
          actor_user_id?: string
          contact_id?: string
          created_at?: string
          id?: string
          org_id?: string
          processed_at?: string
          reason?: string
          result?: string | null
          resume_mode?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_archive_requests_contact_id_org_id_fkey"
            columns: ["contact_id", "org_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "contact_archive_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_merge_history: {
        Row: {
          id: string
          merged_at: string
          merged_by: string | null
          org_id: string
          reversed_at: string | null
          reversed_by: string | null
          snapshot: Json
          source_contact_id: string
          target_contact_id: string
        }
        Insert: {
          id?: string
          merged_at?: string
          merged_by?: string | null
          org_id: string
          reversed_at?: string | null
          reversed_by?: string | null
          snapshot: Json
          source_contact_id: string
          target_contact_id: string
        }
        Update: {
          id?: string
          merged_at?: string
          merged_by?: string | null
          org_id?: string
          reversed_at?: string | null
          reversed_by?: string | null
          snapshot?: Json
          source_contact_id?: string
          target_contact_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_merge_history_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_merge_history_source_contact_id_fkey"
            columns: ["source_contact_id"]
            isOneToOne: true
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_merge_history_target_contact_id_fkey"
            columns: ["target_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_merge_requests: {
        Row: {
          actor_user_id: string
          created_at: string
          id: string
          merge_history_id: string | null
          org_id: string
          processed_at: string
          reason: string
          source_contact_id: string
          target_contact_id: string
        }
        Insert: {
          actor_user_id?: string
          created_at?: string
          id?: string
          merge_history_id?: string | null
          org_id: string
          processed_at?: string
          reason: string
          source_contact_id: string
          target_contact_id: string
        }
        Update: {
          actor_user_id?: string
          created_at?: string
          id?: string
          merge_history_id?: string | null
          org_id?: string
          processed_at?: string
          reason?: string
          source_contact_id?: string
          target_contact_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_merge_requests_merge_history_id_fkey"
            columns: ["merge_history_id"]
            isOneToOne: false
            referencedRelation: "contact_merge_history"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_merge_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_merge_requests_source_contact_id_org_id_fkey"
            columns: ["source_contact_id", "org_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "contact_merge_requests_target_contact_id_org_id_fkey"
            columns: ["target_contact_id", "org_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
      contact_persona_bindings: {
        Row: {
          bound_at: string
          contact_id: string
          id: string
          org_id: string
          persona_id: string
          source: string
          unbound_at: string | null
        }
        Insert: {
          bound_at?: string
          contact_id: string
          id?: string
          org_id: string
          persona_id: string
          source: string
          unbound_at?: string | null
        }
        Update: {
          bound_at?: string
          contact_id?: string
          id?: string
          org_id?: string
          persona_id?: string
          source?: string
          unbound_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_persona_bindings_contact_id_org_id_fkey"
            columns: ["contact_id", "org_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "contact_persona_bindings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_persona_bindings_persona_id_org_id_fkey"
            columns: ["persona_id", "org_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
      contact_phone_requests: {
        Row: {
          action: string
          actor_user_id: string
          contact_id: string
          created_at: string
          id: string
          make_primary: boolean
          org_id: string
          phone_e164: string | null
          phone_id: string | null
          phone_original: string | null
          processed_at: string
          processed_phone_id: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string
          contact_id: string
          created_at?: string
          id?: string
          make_primary?: boolean
          org_id: string
          phone_e164?: string | null
          phone_id?: string | null
          phone_original?: string | null
          processed_at?: string
          processed_phone_id?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string
          contact_id?: string
          created_at?: string
          id?: string
          make_primary?: boolean
          org_id?: string
          phone_e164?: string | null
          phone_id?: string | null
          phone_original?: string | null
          processed_at?: string
          processed_phone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_phone_requests_contact_id_org_id_fkey"
            columns: ["contact_id", "org_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "contact_phone_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_phone_requests_phone_id_org_id_fkey"
            columns: ["phone_id", "org_id"]
            isOneToOne: false
            referencedRelation: "contact_phones"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
      contact_name_update_requests: {
        Row: {
          actor_user_id: string
          contact_id: string
          created_at: string
          id: string
          name: string
          org_id: string
          processed_at: string
        }
        Insert: {
          actor_user_id?: string
          contact_id: string
          created_at?: string
          id?: string
          name: string
          org_id: string
          processed_at?: string
        }
        Update: {
          actor_user_id?: string
          contact_id?: string
          created_at?: string
          id?: string
          name?: string
          org_id?: string
          processed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_name_update_requests_contact_id_org_id_fkey"
            columns: ["contact_id", "org_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "contact_name_update_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
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
      contact_tags: {
        Row: {
          contact_id: string
          created_at: string
          created_by: string | null
          id: string
          label: string
          org_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          label: string
          org_id: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_tags_contact_id_org_id_fkey"
            columns: ["contact_id", "org_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "contact_tags_org_id_fkey"
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
      conversation_access_grants: {
        Row: {
          conversation_id: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          membership_id: string
          org_id: string
          reason: string
          revoked_at: string | null
          starts_at: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          membership_id: string
          org_id: string
          reason: string
          revoked_at?: string | null
          starts_at?: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          membership_id?: string
          org_id?: string
          reason?: string
          revoked_at?: string | null
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_access_grants_conversation_id_org_id_fkey"
            columns: ["conversation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "conversation_access_grants_conversation_id_org_id_fkey"
            columns: ["conversation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "inbox_notification_counts"
            referencedColumns: ["conversation_id", "org_id"]
          },
          {
            foreignKeyName: "conversation_access_grants_membership_id_org_id_fkey"
            columns: ["membership_id", "org_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "conversation_access_grants_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_ai_guidance: {
        Row: {
          consumed_at: string | null
          conversation_id: string
          created_at: string
          created_by: string
          exact_reply: boolean
          guidance: string
          id: string
          org_id: string
          source_suggestion_id: string | null
          status: string
        }
        Insert: {
          consumed_at?: string | null
          conversation_id: string
          created_at?: string
          created_by?: string
          exact_reply?: boolean
          guidance: string
          id?: string
          org_id: string
          source_suggestion_id?: string | null
          status?: string
        }
        Update: {
          consumed_at?: string | null
          conversation_id?: string
          created_at?: string
          created_by?: string
          exact_reply?: boolean
          guidance?: string
          id?: string
          org_id?: string
          source_suggestion_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_ai_guidance_conversation_id_org_id_fkey"
            columns: ["conversation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "conversation_ai_guidance_conversation_id_org_id_fkey"
            columns: ["conversation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "inbox_notification_counts"
            referencedColumns: ["conversation_id", "org_id"]
          },
          {
            foreignKeyName: "conversation_ai_guidance_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_ai_guidance_source_suggestion_id_org_id_fkey"
            columns: ["source_suggestion_id", "org_id"]
            isOneToOne: false
            referencedRelation: "ai_suggestions"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
      conversation_context_versions: {
        Row: {
          conversation_id: string
          created_at: string
          frozen: boolean
          id: string
          institutional_snapshot: Json
          org_id: string
          persona_version_id: string
          project_snapshot_ids: string[]
          qualification_version_id: string | null
          rule_version_id: string
          version: number
        }
        Insert: {
          conversation_id: string
          created_at?: string
          frozen?: boolean
          id?: string
          institutional_snapshot?: Json
          org_id: string
          persona_version_id: string
          project_snapshot_ids?: string[]
          qualification_version_id?: string | null
          rule_version_id: string
          version: number
        }
        Update: {
          conversation_id?: string
          created_at?: string
          frozen?: boolean
          id?: string
          institutional_snapshot?: Json
          org_id?: string
          persona_version_id?: string
          project_snapshot_ids?: string[]
          qualification_version_id?: string | null
          rule_version_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "conversation_context_qualification_version_id_fkey"
            columns: ["qualification_version_id", "org_id"]
            isOneToOne: false
            referencedRelation: "qualification_versions"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "conversation_context_versions_conversation_id_org_id_fkey"
            columns: ["conversation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "conversation_context_versions_conversation_id_org_id_fkey"
            columns: ["conversation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "inbox_notification_counts"
            referencedColumns: ["conversation_id", "org_id"]
          },
          {
            foreignKeyName: "conversation_context_versions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_context_versions_persona_version_id_org_id_fkey"
            columns: ["persona_version_id", "org_id"]
            isOneToOne: false
            referencedRelation: "persona_versions"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "conversation_context_versions_rule_version_id_org_id_fkey"
            columns: ["rule_version_id", "org_id"]
            isOneToOne: false
            referencedRelation: "rule_versions"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
      conversation_read_states: {
        Row: {
          conversation_id: string
          created_at: string
          last_read_inbound_at: string
          org_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          last_read_inbound_at?: string
          org_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          last_read_inbound_at?: string
          org_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_read_states_conversation_id_org_id_fkey"
            columns: ["conversation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "conversation_read_states_conversation_id_org_id_fkey"
            columns: ["conversation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "inbox_notification_counts"
            referencedColumns: ["conversation_id", "org_id"]
          },
          {
            foreignKeyName: "conversation_read_states_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_summaries: {
        Row: {
          conversation_id: string
          created_at: string
          facts: Json
          generated_by: string
          id: string
          message_cursor_id: string | null
          org_id: string
          source_execution_id: string | null
          summary: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          facts?: Json
          generated_by: string
          id?: string
          message_cursor_id?: string | null
          org_id: string
          source_execution_id?: string | null
          summary: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          facts?: Json
          generated_by?: string
          id?: string
          message_cursor_id?: string | null
          org_id?: string
          source_execution_id?: string | null
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_summaries_conversation_id_org_id_fkey"
            columns: ["conversation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "conversation_summaries_conversation_id_org_id_fkey"
            columns: ["conversation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "inbox_notification_counts"
            referencedColumns: ["conversation_id", "org_id"]
          },
          {
            foreignKeyName: "conversation_summaries_message_cursor_id_fkey"
            columns: ["message_cursor_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_summaries_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_summaries_source_execution_id_fkey"
            columns: ["source_execution_id"]
            isOneToOne: false
            referencedRelation: "ai_executions"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_takeover_requests: {
        Row: {
          action: string
          actor_user_id: string
          conversation_id: string
          created_at: string
          expected_version: number
          id: string
          org_id: string
          processed_at: string
          reason: string | null
          resulting_version: number | null
        }
        Insert: {
          action: string
          actor_user_id?: string
          conversation_id: string
          created_at?: string
          expected_version: number
          id?: string
          org_id: string
          processed_at?: string
          reason?: string | null
          resulting_version?: number | null
        }
        Update: {
          action?: string
          actor_user_id?: string
          conversation_id?: string
          created_at?: string
          expected_version?: number
          id?: string
          org_id?: string
          processed_at?: string
          reason?: string | null
          resulting_version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_takeover_requests_conversation_id_org_id_fkey"
            columns: ["conversation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "conversation_takeover_requests_conversation_id_org_id_fkey"
            columns: ["conversation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "inbox_notification_counts"
            referencedColumns: ["conversation_id", "org_id"]
          },
          {
            foreignKeyName: "conversation_takeover_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          ai_mode: string
          assigned_membership_id: string | null
          autonomy_override: string | null
          autonomy_override_expires_at: string | null
          channel: string
          closed_at: string | null
          connection_id: string
          contact_id: string
          created_at: string
          id: string
          journey: string
          last_inbound_at: string | null
          last_message_preview: string | null
          last_outbound_at: string | null
          operation_id: string
          opportunity_id: string
          org_id: string
          ownership: string
          pause_reason: string | null
          started_at: string
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          ai_mode?: string
          assigned_membership_id?: string | null
          autonomy_override?: string | null
          autonomy_override_expires_at?: string | null
          channel?: string
          closed_at?: string | null
          connection_id: string
          contact_id: string
          created_at?: string
          id?: string
          journey?: string
          last_inbound_at?: string | null
          last_message_preview?: string | null
          last_outbound_at?: string | null
          operation_id: string
          opportunity_id: string
          org_id: string
          ownership?: string
          pause_reason?: string | null
          started_at?: string
          status?: string
          updated_at?: string
          version?: number
        }
        Update: {
          ai_mode?: string
          assigned_membership_id?: string | null
          autonomy_override?: string | null
          autonomy_override_expires_at?: string | null
          channel?: string
          closed_at?: string | null
          connection_id?: string
          contact_id?: string
          created_at?: string
          id?: string
          journey?: string
          last_inbound_at?: string | null
          last_message_preview?: string | null
          last_outbound_at?: string | null
          operation_id?: string
          opportunity_id?: string
          org_id?: string
          ownership?: string
          pause_reason?: string | null
          started_at?: string
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "conversations_assigned_membership_id_org_id_fkey"
            columns: ["assigned_membership_id", "org_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "conversations_connection_id_org_id_fkey"
            columns: ["connection_id", "org_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_connections"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "conversations_contact_id_org_id_fkey"
            columns: ["contact_id", "org_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "conversations_operation_id_org_id_fkey"
            columns: ["operation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "conversations_opportunity_id_org_id_fkey"
            columns: ["opportunity_id", "org_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "conversations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_bulk_action_requests: {
        Row: {
          action: string
          actor_user_id: string
          contact_ids: string[]
          created_at: string
          id: string
          org_id: string
          payload: Json
          preview_count: number
          processed_at: string
          result: Json
        }
        Insert: {
          action: string
          actor_user_id?: string
          contact_ids: string[]
          created_at?: string
          id?: string
          org_id: string
          payload?: Json
          preview_count?: number
          processed_at?: string
          result?: Json
        }
        Update: {
          action?: string
          actor_user_id?: string
          contact_ids?: string[]
          created_at?: string
          id?: string
          org_id?: string
          payload?: Json
          preview_count?: number
          processed_at?: string
          result?: Json
        }
        Relationships: [
          {
            foreignKeyName: "crm_bulk_action_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_export_requests: {
        Row: {
          actor_user_id: string
          completed_at: string | null
          contact_ids: string[]
          created_at: string
          error_redacted: string | null
          expires_at: string | null
          id: string
          org_id: string
          status: string
          storage_bucket: string | null
          storage_path: string | null
        }
        Insert: {
          actor_user_id?: string
          completed_at?: string | null
          contact_ids: string[]
          created_at?: string
          error_redacted?: string | null
          expires_at?: string | null
          id?: string
          org_id: string
          status?: string
          storage_bucket?: string | null
          storage_path?: string | null
        }
        Update: {
          actor_user_id?: string
          completed_at?: string | null
          contact_ids?: string[]
          created_at?: string
          error_redacted?: string | null
          expires_at?: string | null
          id?: string
          org_id?: string
          status?: string
          storage_bucket?: string | null
          storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_export_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      escalations: {
        Row: {
          category: string
          claimed_at: string | null
          claimed_by: string | null
          confidence: number | null
          contextual_evidence: string | null
          conversation_id: string | null
          created_at: string
          id: string
          operation_id: string
          opportunity_id: string | null
          org_id: string
          reason: string
          resolved_at: string | null
          severity: string
          source_execution_id: string | null
          source_message_id: string | null
          status: string
        }
        Insert: {
          category: string
          claimed_at?: string | null
          claimed_by?: string | null
          confidence?: number | null
          contextual_evidence?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          operation_id: string
          opportunity_id?: string | null
          org_id: string
          reason: string
          resolved_at?: string | null
          severity: string
          source_execution_id?: string | null
          source_message_id?: string | null
          status?: string
        }
        Update: {
          category?: string
          claimed_at?: string | null
          claimed_by?: string | null
          confidence?: number | null
          contextual_evidence?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          operation_id?: string
          opportunity_id?: string | null
          org_id?: string
          reason?: string
          resolved_at?: string | null
          severity?: string
          source_execution_id?: string | null
          source_message_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "escalations_claimed_by_fkey"
            columns: ["claimed_by"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalations_conversation_id_org_id_fkey"
            columns: ["conversation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "escalations_conversation_id_org_id_fkey"
            columns: ["conversation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "inbox_notification_counts"
            referencedColumns: ["conversation_id", "org_id"]
          },
          {
            foreignKeyName: "escalations_operation_id_org_id_fkey"
            columns: ["operation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "escalations_opportunity_id_org_id_fkey"
            columns: ["opportunity_id", "org_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "escalations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalations_source_execution_id_fkey"
            columns: ["source_execution_id"]
            isOneToOne: false
            referencedRelation: "ai_executions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalations_source_message_id_fkey"
            columns: ["source_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      experiment_assignments: {
        Row: {
          assigned_at: string
          assignment_key: string
          conversation_id: string | null
          experiment_id: string
          id: string
          opportunity_id: string
          org_id: string
          variant_id: string
        }
        Insert: {
          assigned_at?: string
          assignment_key: string
          conversation_id?: string | null
          experiment_id: string
          id?: string
          opportunity_id: string
          org_id: string
          variant_id: string
        }
        Update: {
          assigned_at?: string
          assignment_key?: string
          conversation_id?: string | null
          experiment_id?: string
          id?: string
          opportunity_id?: string
          org_id?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "experiment_assignments_conversation_id_org_id_fkey"
            columns: ["conversation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "experiment_assignments_conversation_id_org_id_fkey"
            columns: ["conversation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "inbox_notification_counts"
            referencedColumns: ["conversation_id", "org_id"]
          },
          {
            foreignKeyName: "experiment_assignments_experiment_id_org_id_fkey"
            columns: ["experiment_id", "org_id"]
            isOneToOne: false
            referencedRelation: "experiments"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "experiment_assignments_opportunity_id_org_id_fkey"
            columns: ["opportunity_id", "org_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "experiment_assignments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experiment_assignments_variant_id_org_id_fkey"
            columns: ["variant_id", "org_id"]
            isOneToOne: false
            referencedRelation: "experiment_variants"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
      experiment_events: {
        Row: {
          event_type: string
          experiment_id: string
          id: number
          metadata: Json
          occurred_at: string
          org_id: string
          severity: string
          variant_id: string | null
        }
        Insert: {
          event_type: string
          experiment_id: string
          id?: never
          metadata?: Json
          occurred_at?: string
          org_id: string
          severity: string
          variant_id?: string | null
        }
        Update: {
          event_type?: string
          experiment_id?: string
          id?: never
          metadata?: Json
          occurred_at?: string
          org_id?: string
          severity?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "experiment_events_experiment_id_org_id_fkey"
            columns: ["experiment_id", "org_id"]
            isOneToOne: false
            referencedRelation: "experiments"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "experiment_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experiment_events_variant_id_org_id_fkey"
            columns: ["variant_id", "org_id"]
            isOneToOne: false
            referencedRelation: "experiment_variants"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
      experiment_transition_requests: {
        Row: {
          action: string
          actor_user_id: string
          created_at: string
          experiment_id: string
          id: string
          org_id: string
          processed_at: string
          reason: string | null
          result: string | null
          winner_variant_id: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string
          created_at?: string
          experiment_id: string
          id?: string
          org_id: string
          processed_at?: string
          reason?: string | null
          result?: string | null
          winner_variant_id?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string
          created_at?: string
          experiment_id?: string
          id?: string
          org_id?: string
          processed_at?: string
          reason?: string | null
          result?: string | null
          winner_variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "experiment_transition_requests_experiment_id_org_id_fkey"
            columns: ["experiment_id", "org_id"]
            isOneToOne: false
            referencedRelation: "experiments"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "experiment_transition_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      experiment_variants: {
        Row: {
          allocation_percent: number
          created_at: string
          critical_errors: number
          experiment_id: string
          id: string
          name: string
          org_id: string
          persona_version_id: string
          rule_version_id: string
          status: string
        }
        Insert: {
          allocation_percent: number
          created_at?: string
          critical_errors?: number
          experiment_id: string
          id?: string
          name: string
          org_id: string
          persona_version_id: string
          rule_version_id: string
          status?: string
        }
        Update: {
          allocation_percent?: number
          created_at?: string
          critical_errors?: number
          experiment_id?: string
          id?: string
          name?: string
          org_id?: string
          persona_version_id?: string
          rule_version_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "experiment_variants_experiment_id_org_id_fkey"
            columns: ["experiment_id", "org_id"]
            isOneToOne: false
            referencedRelation: "experiments"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "experiment_variants_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experiment_variants_persona_version_id_org_id_fkey"
            columns: ["persona_version_id", "org_id"]
            isOneToOne: false
            referencedRelation: "persona_versions"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "experiment_variants_rule_version_id_org_id_fkey"
            columns: ["rule_version_id", "org_id"]
            isOneToOne: false
            referencedRelation: "rule_versions"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
      experiments: {
        Row: {
          created_at: string
          created_by: string | null
          eligibility: Json
          ends_at: string | null
          id: string
          name: string
          operation_id: string | null
          org_id: string
          scope: string
          starts_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          eligibility?: Json
          ends_at?: string | null
          id?: string
          name: string
          operation_id?: string | null
          org_id: string
          scope: string
          starts_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          eligibility?: Json
          ends_at?: string | null
          id?: string
          name?: string
          operation_id?: string | null
          org_id?: string
          scope?: string
          starts_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "experiments_operation_id_org_id_fkey"
            columns: ["operation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "experiments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      faq_creation_requests: {
        Row: {
          actor_user_id: string
          base_answer: string
          canonical_question: string
          created_at: string
          faq_entry_id: string | null
          id: string
          org_id: string
          processed_at: string
          response_mode: string
          source_name: string
        }
        Insert: {
          actor_user_id?: string
          base_answer: string
          canonical_question: string
          created_at?: string
          faq_entry_id?: string | null
          id?: string
          org_id: string
          processed_at?: string
          response_mode: string
          source_name: string
        }
        Update: {
          actor_user_id?: string
          base_answer?: string
          canonical_question?: string
          created_at?: string
          faq_entry_id?: string | null
          id?: string
          org_id?: string
          processed_at?: string
          response_mode?: string
          source_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "faq_creation_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      faq_entries: {
        Row: {
          canonical_question: string
          created_at: string
          created_by: string | null
          id: string
          org_id: string
          project_id: string | null
          scope: string
          status: string
          updated_at: string
        }
        Insert: {
          canonical_question: string
          created_at?: string
          created_by?: string | null
          id?: string
          org_id: string
          project_id?: string | null
          scope: string
          status?: string
          updated_at?: string
        }
        Update: {
          canonical_question?: string
          created_at?: string
          created_by?: string | null
          id?: string
          org_id?: string
          project_id?: string | null
          scope?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "faq_entries_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faq_entries_project_id_org_id_fkey"
            columns: ["project_id", "org_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
      faq_versions: {
        Row: {
          allowed_dynamic_fields: string[]
          base_answer: string
          caveats: string | null
          checksum: string
          created_at: string
          faq_entry_id: string
          forbidden_claims: Json
          id: string
          org_id: string
          published_at: string | null
          published_by: string | null
          question_variations: Json
          response_mode: string
          source_name: string | null
          status: string
          updated_at: string
          valid_until: string | null
          version: number
        }
        Insert: {
          allowed_dynamic_fields?: string[]
          base_answer: string
          caveats?: string | null
          checksum: string
          created_at?: string
          faq_entry_id: string
          forbidden_claims?: Json
          id?: string
          org_id: string
          published_at?: string | null
          published_by?: string | null
          question_variations?: Json
          response_mode: string
          source_name?: string | null
          status?: string
          updated_at?: string
          valid_until?: string | null
          version: number
        }
        Update: {
          allowed_dynamic_fields?: string[]
          base_answer?: string
          caveats?: string | null
          checksum?: string
          created_at?: string
          faq_entry_id?: string
          forbidden_claims?: Json
          id?: string
          org_id?: string
          published_at?: string | null
          published_by?: string | null
          question_variations?: Json
          response_mode?: string
          source_name?: string | null
          status?: string
          updated_at?: string
          valid_until?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "faq_versions_faq_entry_id_org_id_fkey"
            columns: ["faq_entry_id", "org_id"]
            isOneToOne: false
            referencedRelation: "faq_entries"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "faq_versions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      followup_plans: {
        Row: {
          created_at: string
          created_by: string | null
          horizon_days: number
          id: string
          max_attempts: number
          name: string
          operation_id: string
          org_id: string
          published_at: string | null
          status: string
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          horizon_days?: number
          id?: string
          max_attempts?: number
          name: string
          operation_id: string
          org_id: string
          published_at?: string | null
          status?: string
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          horizon_days?: number
          id?: string
          max_attempts?: number
          name?: string
          operation_id?: string
          org_id?: string
          published_at?: string | null
          status?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "followup_plans_operation_id_org_id_fkey"
            columns: ["operation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "followup_plans_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      followup_steps: {
        Row: {
          channel: string
          created_at: string
          delay_minutes: number
          id: string
          instruction: string
          org_id: string
          plan_id: string
          step_number: number
        }
        Insert: {
          channel?: string
          created_at?: string
          delay_minutes: number
          id?: string
          instruction: string
          org_id: string
          plan_id: string
          step_number: number
        }
        Update: {
          channel?: string
          created_at?: string
          delay_minutes?: number
          id?: string
          instruction?: string
          org_id?: string
          plan_id?: string
          step_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "followup_steps_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followup_steps_plan_id_org_id_fkey"
            columns: ["plan_id", "org_id"]
            isOneToOne: false
            referencedRelation: "followup_plans"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
      integration_accounts: {
        Row: {
          base_url: string | null
          connected_by: string | null
          created_at: string
          credential_hint: string
          external_account_id: string | null
          external_business_id: string | null
          external_phone_number_id: string | null
          id: string
          label: string
          last_checked_at: string | null
          last_error_redacted: string | null
          metadata: Json
          org_id: string
          phone_e164: string | null
          provider: string
          revoked_at: string | null
          status: string
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          base_url?: string | null
          connected_by?: string | null
          created_at?: string
          credential_hint: string
          external_account_id?: string | null
          external_business_id?: string | null
          external_phone_number_id?: string | null
          id?: string
          label: string
          last_checked_at?: string | null
          last_error_redacted?: string | null
          metadata?: Json
          org_id: string
          phone_e164?: string | null
          provider: string
          revoked_at?: string | null
          status?: string
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          base_url?: string | null
          connected_by?: string | null
          created_at?: string
          credential_hint?: string
          external_account_id?: string | null
          external_business_id?: string | null
          external_phone_number_id?: string | null
          id?: string
          label?: string
          last_checked_at?: string | null
          last_error_redacted?: string | null
          metadata?: Json
          org_id?: string
          phone_e164?: string | null
          provider?: string
          revoked_at?: string | null
          status?: string
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_accounts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_health_checks: {
        Row: {
          checked_at: string
          component: string
          error_redacted: string | null
          id: number
          latency_ms: number | null
          metadata: Json
          operation_id: string | null
          org_id: string | null
          status: string
          target_id: string | null
        }
        Insert: {
          checked_at?: string
          component: string
          error_redacted?: string | null
          id?: never
          latency_ms?: number | null
          metadata?: Json
          operation_id?: string | null
          org_id?: string | null
          status: string
          target_id?: string | null
        }
        Update: {
          checked_at?: string
          component?: string
          error_redacted?: string | null
          id?: never
          latency_ms?: number | null
          metadata?: Json
          operation_id?: string | null
          org_id?: string | null
          status?: string
          target_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_health_checks_operation_id_org_id_fkey"
            columns: ["operation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "integration_health_checks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_action_proposals: {
        Row: {
          action_payload: Json
          action_type: string
          confirmed_at: string | null
          confirmed_by: string | null
          context_version: number
          conversation_id: string | null
          created_at: string
          id: string
          message_id: string
          org_id: string
          result: Json | null
          status: string
          thread_id: string
          updated_at: string
        }
        Insert: {
          action_payload?: Json
          action_type: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          context_version: number
          conversation_id?: string | null
          created_at?: string
          id?: string
          message_id: string
          org_id: string
          result?: Json | null
          status?: string
          thread_id: string
          updated_at?: string
        }
        Update: {
          action_payload?: Json
          action_type?: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          context_version?: number
          conversation_id?: string | null
          created_at?: string
          id?: string
          message_id?: string
          org_id?: string
          result?: Json | null
          status?: string
          thread_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_action_proposals_conversation_id_org_id_fkey"
            columns: ["conversation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "internal_action_proposals_conversation_id_org_id_fkey"
            columns: ["conversation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "inbox_notification_counts"
            referencedColumns: ["conversation_id", "org_id"]
          },
          {
            foreignKeyName: "internal_action_proposals_message_id_org_id_fkey"
            columns: ["message_id", "org_id"]
            isOneToOne: false
            referencedRelation: "internal_messages"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "internal_action_proposals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_action_proposals_thread_id_org_id_fkey"
            columns: ["thread_id", "org_id"]
            isOneToOne: false
            referencedRelation: "internal_threads"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
      internal_messages: {
        Row: {
          actor_kind: string
          actor_user_id: string | null
          body: string
          created_at: string
          id: string
          message_kind: string
          metadata: Json
          org_id: string
          reply_to_message_id: string | null
          thread_id: string
        }
        Insert: {
          actor_kind: string
          actor_user_id?: string | null
          body: string
          created_at?: string
          id?: string
          message_kind?: string
          metadata?: Json
          org_id: string
          reply_to_message_id?: string | null
          thread_id: string
        }
        Update: {
          actor_kind?: string
          actor_user_id?: string | null
          body?: string
          created_at?: string
          id?: string
          message_kind?: string
          metadata?: Json
          org_id?: string
          reply_to_message_id?: string | null
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_messages_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_messages_reply_to_message_id_fkey"
            columns: ["reply_to_message_id"]
            isOneToOne: false
            referencedRelation: "internal_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_messages_thread_id_org_id_fkey"
            columns: ["thread_id", "org_id"]
            isOneToOne: false
            referencedRelation: "internal_threads"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
      internal_thread_reads: {
        Row: {
          last_read_at: string
          org_id: string
          thread_id: string
          user_id: string
        }
        Insert: {
          last_read_at?: string
          org_id: string
          thread_id: string
          user_id: string
        }
        Update: {
          last_read_at?: string
          org_id?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_thread_reads_thread_id_org_id_fkey"
            columns: ["thread_id", "org_id"]
            isOneToOne: false
            referencedRelation: "internal_threads"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
      internal_threads: {
        Row: {
          archived_at: string | null
          assigned_membership_id: string | null
          assistant_role: string
          broker_membership_id: string | null
          context_version: number
          conversation_id: string | null
          created_at: string
          created_by: string | null
          id: string
          metadata: Json
          operation_id: string | null
          opportunity_id: string | null
          org_id: string
          parent_thread_id: string | null
          priority: string
          requires_action: boolean
          resolved_at: string | null
          source: string
          status: string
          thread_type: string
          title: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          assigned_membership_id?: string | null
          assistant_role: string
          broker_membership_id?: string | null
          context_version?: number
          conversation_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json
          operation_id?: string | null
          opportunity_id?: string | null
          org_id: string
          parent_thread_id?: string | null
          priority?: string
          requires_action?: boolean
          resolved_at?: string | null
          source?: string
          status?: string
          thread_type: string
          title: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          assigned_membership_id?: string | null
          assistant_role?: string
          broker_membership_id?: string | null
          context_version?: number
          conversation_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json
          operation_id?: string | null
          opportunity_id?: string | null
          org_id?: string
          parent_thread_id?: string | null
          priority?: string
          requires_action?: boolean
          resolved_at?: string | null
          source?: string
          status?: string
          thread_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_threads_assigned_membership_id_org_id_fkey"
            columns: ["assigned_membership_id", "org_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "internal_threads_broker_membership_id_org_id_fkey"
            columns: ["broker_membership_id", "org_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "internal_threads_conversation_id_org_id_fkey"
            columns: ["conversation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "internal_threads_conversation_id_org_id_fkey"
            columns: ["conversation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "inbox_notification_counts"
            referencedColumns: ["conversation_id", "org_id"]
          },
          {
            foreignKeyName: "internal_threads_operation_id_org_id_fkey"
            columns: ["operation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "internal_threads_opportunity_id_org_id_fkey"
            columns: ["opportunity_id", "org_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "internal_threads_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_threads_parent_thread_id_fkey"
            columns: ["parent_thread_id"]
            isOneToOne: false
            referencedRelation: "internal_threads"
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
          expires_at: string | null
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
          expires_at?: string | null
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
          expires_at?: string | null
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
      learning_review_requests: {
        Row: {
          actor_user_id: string
          created_at: string
          decision: string
          draft_rule_version_id: string | null
          id: string
          learning_suggestion_id: string
          org_id: string
          processed_at: string
          reason: string | null
          regression_case_id: string | null
        }
        Insert: {
          actor_user_id?: string
          created_at?: string
          decision: string
          draft_rule_version_id?: string | null
          id?: string
          learning_suggestion_id: string
          org_id: string
          processed_at?: string
          reason?: string | null
          regression_case_id?: string | null
        }
        Update: {
          actor_user_id?: string
          created_at?: string
          decision?: string
          draft_rule_version_id?: string | null
          id?: string
          learning_suggestion_id?: string
          org_id?: string
          processed_at?: string
          reason?: string | null
          regression_case_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "learning_review_requests_learning_suggestion_id_org_id_fkey"
            columns: ["learning_suggestion_id", "org_id"]
            isOneToOne: false
            referencedRelation: "learning_suggestions"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "learning_review_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_suggestions: {
        Row: {
          activated_at: string | null
          candidate_kind: string
          conflict_details: string | null
          conversation_id: string | null
          created_at: string
          created_by: string
          draft_rule_version_id: string | null
          duration: string
          evidence: Json
          human_observation: string
          id: string
          message_id: string | null
          observed_response: string | null
          operation_id: string | null
          org_id: string
          regression_case_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          rolled_back_at: string | null
          scope: string
          source: string
          source_thread_id: string | null
          status: string
          suggested_change: string
          supersedes_id: string | null
          target_scope: Json
          updated_at: string
          version: number
        }
        Insert: {
          activated_at?: string | null
          candidate_kind?: string
          conflict_details?: string | null
          conversation_id?: string | null
          created_at?: string
          created_by?: string
          draft_rule_version_id?: string | null
          duration?: string
          evidence?: Json
          human_observation: string
          id?: string
          message_id?: string | null
          observed_response?: string | null
          operation_id?: string | null
          org_id: string
          regression_case_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          rolled_back_at?: string | null
          scope: string
          source: string
          source_thread_id?: string | null
          status?: string
          suggested_change: string
          supersedes_id?: string | null
          target_scope?: Json
          updated_at?: string
          version?: number
        }
        Update: {
          activated_at?: string | null
          candidate_kind?: string
          conflict_details?: string | null
          conversation_id?: string | null
          created_at?: string
          created_by?: string
          draft_rule_version_id?: string | null
          duration?: string
          evidence?: Json
          human_observation?: string
          id?: string
          message_id?: string | null
          observed_response?: string | null
          operation_id?: string | null
          org_id?: string
          regression_case_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          rolled_back_at?: string | null
          scope?: string
          source?: string
          source_thread_id?: string | null
          status?: string
          suggested_change?: string
          supersedes_id?: string | null
          target_scope?: Json
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "learning_suggestions_conversation_id_org_id_fkey"
            columns: ["conversation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "learning_suggestions_conversation_id_org_id_fkey"
            columns: ["conversation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "inbox_notification_counts"
            referencedColumns: ["conversation_id", "org_id"]
          },
          {
            foreignKeyName: "learning_suggestions_draft_rule_version_id_org_id_fkey"
            columns: ["draft_rule_version_id", "org_id"]
            isOneToOne: false
            referencedRelation: "rule_versions"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "learning_suggestions_message_id_org_id_fkey"
            columns: ["message_id", "org_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "learning_suggestions_operation_id_org_id_fkey"
            columns: ["operation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "learning_suggestions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_suggestions_regression_case_fkey"
            columns: ["regression_case_id", "org_id"]
            isOneToOne: false
            referencedRelation: "regression_cases"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "learning_suggestions_source_thread_id_fkey"
            columns: ["source_thread_id"]
            isOneToOne: false
            referencedRelation: "internal_threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_suggestions_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "learning_suggestions"
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
      membership_call_settings: {
        Row: {
          can_receive_calls: boolean
          is_preferred_receiver: boolean
          membership_id: string
          operation_id: string
          org_id: string
          receive_urgent_call_alerts: boolean
          temporary_unavailable_from: string | null
          temporary_unavailable_until: string | null
          unavailable_reason: string | null
          updated_at: string
          version: number
        }
        Insert: {
          can_receive_calls?: boolean
          is_preferred_receiver?: boolean
          membership_id: string
          operation_id: string
          org_id: string
          receive_urgent_call_alerts?: boolean
          temporary_unavailable_from?: string | null
          temporary_unavailable_until?: string | null
          unavailable_reason?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          can_receive_calls?: boolean
          is_preferred_receiver?: boolean
          membership_id?: string
          operation_id?: string
          org_id?: string
          receive_urgent_call_alerts?: boolean
          temporary_unavailable_from?: string | null
          temporary_unavailable_until?: string | null
          unavailable_reason?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "membership_call_settings_membership_id_org_id_fkey"
            columns: ["membership_id", "org_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "membership_call_settings_operation_id_org_id_fkey"
            columns: ["operation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id", "org_id"]
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
      message_media_sources: {
        Row: {
          attempts: number
          connection_id: string
          created_at: string
          error_redacted: string | null
          extracted_text: string | null
          file_name: string | null
          message_id: string
          mime_type: string | null
          org_id: string
          processed_at: string | null
          provider_media_id: string | null
          provider_sha256: string | null
          source_url: string | null
          status: string
          storage_bucket: string | null
          storage_path: string | null
          updated_at: string
        }
        Insert: {
          attempts?: number
          connection_id: string
          created_at?: string
          error_redacted?: string | null
          extracted_text?: string | null
          file_name?: string | null
          message_id: string
          mime_type?: string | null
          org_id: string
          processed_at?: string | null
          provider_media_id?: string | null
          provider_sha256?: string | null
          source_url?: string | null
          status?: string
          storage_bucket?: string | null
          storage_path?: string | null
          updated_at?: string
        }
        Update: {
          attempts?: number
          connection_id?: string
          created_at?: string
          error_redacted?: string | null
          extracted_text?: string | null
          file_name?: string | null
          message_id?: string
          mime_type?: string | null
          org_id?: string
          processed_at?: string | null
          provider_media_id?: string | null
          provider_sha256?: string | null
          source_url?: string | null
          status?: string
          storage_bucket?: string | null
          storage_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_media_sources_connection_id_org_id_fkey"
            columns: ["connection_id", "org_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_connections"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "message_media_sources_message_id_org_id_fkey"
            columns: ["message_id", "org_id"]
            isOneToOne: true
            referencedRelation: "messages"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
      message_mutations: {
        Row: {
          body: string | null
          connection_id: string
          created_at: string
          emoji: string | null
          external_event_id: string
          id: string
          kind: string
          message_id: string
          org_id: string
          previous_body: string | null
          provider_timestamp: string | null
          revision_message_id: string | null
        }
        Insert: {
          body?: string | null
          connection_id: string
          created_at?: string
          emoji?: string | null
          external_event_id: string
          id?: string
          kind: string
          message_id: string
          org_id: string
          previous_body?: string | null
          provider_timestamp?: string | null
          revision_message_id?: string | null
        }
        Update: {
          body?: string | null
          connection_id?: string
          created_at?: string
          emoji?: string | null
          external_event_id?: string
          id?: string
          kind?: string
          message_id?: string
          org_id?: string
          previous_body?: string | null
          provider_timestamp?: string | null
          revision_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_mutations_connection_id_org_id_fkey"
            columns: ["connection_id", "org_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_connections"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "message_mutations_message_id_org_id_fkey"
            columns: ["message_id", "org_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "message_mutations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_mutations_revision_message_id_fkey"
            columns: ["revision_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_send_requests: {
        Row: {
          actor_user_id: string
          ai_suggestion_id: string | null
          body: string
          conversation_id: string
          created_at: string
          expected_conversation_version: number
          id: string
          message_id: string | null
          org_id: string
          processed_at: string
          reply_to_message_id: string | null
          source: string
        }
        Insert: {
          actor_user_id?: string
          ai_suggestion_id?: string | null
          body: string
          conversation_id: string
          created_at?: string
          expected_conversation_version: number
          id?: string
          message_id?: string | null
          org_id: string
          processed_at?: string
          reply_to_message_id?: string | null
          source?: string
        }
        Update: {
          actor_user_id?: string
          ai_suggestion_id?: string | null
          body?: string
          conversation_id?: string
          created_at?: string
          expected_conversation_version?: number
          id?: string
          message_id?: string | null
          org_id?: string
          processed_at?: string
          reply_to_message_id?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_send_requests_ai_suggestion_fkey"
            columns: ["ai_suggestion_id", "org_id"]
            isOneToOne: false
            referencedRelation: "ai_suggestions"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "message_send_requests_conversation_id_org_id_fkey"
            columns: ["conversation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "message_send_requests_conversation_id_org_id_fkey"
            columns: ["conversation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "inbox_notification_counts"
            referencedColumns: ["conversation_id", "org_id"]
          },
          {
            foreignKeyName: "message_send_requests_message_id_org_id_fkey"
            columns: ["message_id", "org_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "message_send_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_send_requests_reply_to_message_id_fkey"
            columns: ["reply_to_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string | null
          content_type: string
          conversation_id: string
          created_at: string
          direction: string
          error_redacted: string | null
          id: string
          metadata: Json
          operation_id: string
          org_id: string
          provider_message_id: string | null
          provider_status: string
          provider_timestamp: string | null
          reply_to_message_id: string | null
          sender_type: string
          sender_user_id: string | null
        }
        Insert: {
          body?: string | null
          content_type?: string
          conversation_id: string
          created_at?: string
          direction: string
          error_redacted?: string | null
          id?: string
          metadata?: Json
          operation_id: string
          org_id: string
          provider_message_id?: string | null
          provider_status?: string
          provider_timestamp?: string | null
          reply_to_message_id?: string | null
          sender_type: string
          sender_user_id?: string | null
        }
        Update: {
          body?: string | null
          content_type?: string
          conversation_id?: string
          created_at?: string
          direction?: string
          error_redacted?: string | null
          id?: string
          metadata?: Json
          operation_id?: string
          org_id?: string
          provider_message_id?: string | null
          provider_status?: string
          provider_timestamp?: string | null
          reply_to_message_id?: string | null
          sender_type?: string
          sender_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_org_id_fkey"
            columns: ["conversation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "messages_conversation_id_org_id_fkey"
            columns: ["conversation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "inbox_notification_counts"
            referencedColumns: ["conversation_id", "org_id"]
          },
          {
            foreignKeyName: "messages_operation_id_org_id_fkey"
            columns: ["operation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "messages_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_message_id_fkey"
            columns: ["reply_to_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_form_creation_requests: {
        Row: {
          actor_user_id: string
          connection_id: string
          consent_text: string
          created_at: string
          external_form_id: string
          field_mapping: Json
          form_id: string | null
          id: string
          name: string
          operation_id: string
          org_id: string
          processed_at: string
        }
        Insert: {
          actor_user_id?: string
          connection_id: string
          consent_text: string
          created_at?: string
          external_form_id: string
          field_mapping: Json
          form_id?: string | null
          id?: string
          name: string
          operation_id: string
          org_id: string
          processed_at?: string
        }
        Update: {
          actor_user_id?: string
          connection_id?: string
          consent_text?: string
          created_at?: string
          external_form_id?: string
          field_mapping?: Json
          form_id?: string | null
          id?: string
          name?: string
          operation_id?: string
          org_id?: string
          processed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_form_creation_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_form_ingest_requests: {
        Row: {
          created_at: string
          external_submission_id: string
          form_id: string
          id: string
          org_id: string
          payload: Json
          payload_sha256: string
          prelead_id: string | null
          processed_at: string
          result: string | null
          submission_id: string | null
          submitted_at: string | null
        }
        Insert: {
          created_at?: string
          external_submission_id: string
          form_id: string
          id?: string
          org_id: string
          payload: Json
          payload_sha256: string
          prelead_id?: string | null
          processed_at?: string
          result?: string | null
          submission_id?: string | null
          submitted_at?: string | null
        }
        Update: {
          created_at?: string
          external_submission_id?: string
          form_id?: string
          id?: string
          org_id?: string
          payload?: Json
          payload_sha256?: string
          prelead_id?: string | null
          processed_at?: string
          result?: string | null
          submission_id?: string | null
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_form_ingest_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_form_versions: {
        Row: {
          checksum: string
          form_id: string
          id: string
          org_id: string
          published_at: string
          published_by: string | null
          snapshot: Json
          version: number
        }
        Insert: {
          checksum: string
          form_id: string
          id?: string
          org_id: string
          published_at?: string
          published_by?: string | null
          snapshot: Json
          version: number
        }
        Update: {
          checksum?: string
          form_id?: string
          id?: string
          org_id?: string
          published_at?: string
          published_by?: string | null
          snapshot?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "meta_form_versions_form_id_org_id_fkey"
            columns: ["form_id", "org_id"]
            isOneToOne: false
            referencedRelation: "meta_lead_forms"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "meta_form_versions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_lead_forms: {
        Row: {
          connection_id: string
          consent_text: string
          consent_version: number
          created_at: string
          created_by: string | null
          external_form_id: string
          field_mapping: Json
          id: string
          name: string
          operation_id: string
          org_id: string
          status: string
          updated_at: string
        }
        Insert: {
          connection_id: string
          consent_text: string
          consent_version?: number
          created_at?: string
          created_by?: string | null
          external_form_id: string
          field_mapping: Json
          id?: string
          name: string
          operation_id: string
          org_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          connection_id?: string
          consent_text?: string
          consent_version?: number
          created_at?: string
          created_by?: string | null
          external_form_id?: string
          field_mapping?: Json
          id?: string
          name?: string
          operation_id?: string
          org_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_lead_forms_connection_id_org_id_fkey"
            columns: ["connection_id", "org_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_connections"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "meta_lead_forms_operation_id_org_id_fkey"
            columns: ["operation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "meta_lead_forms_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_lead_submissions: {
        Row: {
          external_submission_id: string
          form_id: string
          id: string
          org_id: string
          payload: Json
          payload_sha256: string
          received_at: string
          status: string
          submitted_at: string | null
        }
        Insert: {
          external_submission_id: string
          form_id: string
          id?: string
          org_id: string
          payload: Json
          payload_sha256: string
          received_at?: string
          status?: string
          submitted_at?: string | null
        }
        Update: {
          external_submission_id?: string
          form_id?: string
          id?: string
          org_id?: string
          payload?: Json
          payload_sha256?: string
          received_at?: string
          status?: string
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_lead_submissions_form_id_org_id_fkey"
            columns: ["form_id", "org_id"]
            isOneToOne: false
            referencedRelation: "meta_lead_forms"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "meta_lead_submissions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      model_activation_requests: {
        Row: {
          actor_user_id: string
          created_at: string
          id: string
          model_profile_id: string
          org_id: string
          processed_at: string
        }
        Insert: {
          actor_user_id?: string
          created_at?: string
          id?: string
          model_profile_id: string
          org_id: string
          processed_at?: string
        }
        Update: {
          actor_user_id?: string
          created_at?: string
          id?: string
          model_profile_id?: string
          org_id?: string
          processed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "model_activation_requests_model_profile_id_org_id_fkey"
            columns: ["model_profile_id", "org_id"]
            isOneToOne: false
            referencedRelation: "model_profiles"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "model_activation_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      model_profiles: {
        Row: {
          created_at: string
          created_by: string | null
          endpoint: string
          id: string
          integration_account_id: string | null
          is_default: boolean
          model_identifier: string
          name: string
          org_id: string
          provider: string
          reasoning_effort: string | null
          secret_reference: string | null
          settings: Json
          status: string
          text_verbosity: string
          updated_at: string
          workload_role: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          endpoint?: string
          id?: string
          integration_account_id?: string | null
          is_default?: boolean
          model_identifier: string
          name: string
          org_id: string
          provider?: string
          reasoning_effort?: string | null
          secret_reference?: string | null
          settings?: Json
          status?: string
          text_verbosity?: string
          updated_at?: string
          workload_role: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          endpoint?: string
          id?: string
          integration_account_id?: string | null
          is_default?: boolean
          model_identifier?: string
          name?: string
          org_id?: string
          provider?: string
          reasoning_effort?: string | null
          secret_reference?: string | null
          settings?: Json
          status?: string
          text_verbosity?: string
          updated_at?: string
          workload_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "model_profiles_integration_account_id_fkey"
            columns: ["integration_account_id", "org_id"]
            isOneToOne: false
            referencedRelation: "integration_accounts"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "model_profiles_org_id_fkey"
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
      notifications: {
        Row: {
          alert_id: string | null
          body: string
          channel: string
          created_at: string
          id: string
          org_id: string
          read_at: string | null
          recipient_membership_id: string
          sent_at: string | null
          source_event_id: string | null
          status: string
          title: string
        }
        Insert: {
          alert_id?: string | null
          body: string
          channel: string
          created_at?: string
          id?: string
          org_id: string
          read_at?: string | null
          recipient_membership_id: string
          sent_at?: string | null
          source_event_id?: string | null
          status?: string
          title: string
        }
        Update: {
          alert_id?: string | null
          body?: string
          channel?: string
          created_at?: string
          id?: string
          org_id?: string
          read_at?: string | null
          recipient_membership_id?: string
          sent_at?: string | null
          source_event_id?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_recipient_membership_id_org_id_fkey"
            columns: ["recipient_membership_id", "org_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
      operation_capacity: {
        Row: {
          active_count: number
          below_ten_since: string | null
          last_inbound_at: string | null
          operation_id: string
          org_id: string
          proactive_paused: boolean
          updated_at: string
          version: number
        }
        Insert: {
          active_count?: number
          below_ten_since?: string | null
          last_inbound_at?: string | null
          operation_id: string
          org_id: string
          proactive_paused?: boolean
          updated_at?: string
          version?: number
        }
        Update: {
          active_count?: number
          below_ten_since?: string | null
          last_inbound_at?: string | null
          operation_id?: string
          org_id?: string
          proactive_paused?: boolean
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "operation_capacity_operation_id_org_id_fkey"
            columns: ["operation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
      operation_settings: {
        Row: {
          autonomy_level: string | null
          business_hours: Json
          campaign_window_end: string
          campaign_window_start: string
          created_at: string
          default_persona_id: string | null
          grouping_seconds: number
          inbound_window_end: string
          inbound_window_start: string
          max_grouping_seconds: number
          operation_id: string
          operational_phone_e164: string | null
          org_id: string
          proactive_openings_per_minute: number
          updated_at: string
        }
        Insert: {
          autonomy_level?: string | null
          business_hours?: Json
          campaign_window_end?: string
          campaign_window_start?: string
          created_at?: string
          default_persona_id?: string | null
          grouping_seconds?: number
          inbound_window_end?: string
          inbound_window_start?: string
          max_grouping_seconds?: number
          operation_id: string
          operational_phone_e164?: string | null
          org_id: string
          proactive_openings_per_minute?: number
          updated_at?: string
        }
        Update: {
          autonomy_level?: string | null
          business_hours?: Json
          campaign_window_end?: string
          campaign_window_start?: string
          created_at?: string
          default_persona_id?: string | null
          grouping_seconds?: number
          inbound_window_end?: string
          inbound_window_start?: string
          max_grouping_seconds?: number
          operation_id?: string
          operational_phone_e164?: string | null
          org_id?: string
          proactive_openings_per_minute?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "operation_settings_default_persona_id_fkey"
            columns: ["default_persona_id", "org_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "operation_settings_operation_id_org_id_fkey"
            columns: ["operation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
      operational_messages: {
        Row: {
          body: string
          connection_id: string
          created_at: string
          dedupe_key: string
          entity_id: string | null
          entity_type: string | null
          error_redacted: string | null
          id: string
          metadata: Json
          operation_id: string
          org_id: string
          provider_message_id: string | null
          provider_timestamp: string | null
          purpose: string
          recipient_membership_id: string
          status: string
          to_e164: string
          updated_at: string
        }
        Insert: {
          body: string
          connection_id: string
          created_at?: string
          dedupe_key: string
          entity_id?: string | null
          entity_type?: string | null
          error_redacted?: string | null
          id?: string
          metadata?: Json
          operation_id: string
          org_id: string
          provider_message_id?: string | null
          provider_timestamp?: string | null
          purpose: string
          recipient_membership_id: string
          status?: string
          to_e164: string
          updated_at?: string
        }
        Update: {
          body?: string
          connection_id?: string
          created_at?: string
          dedupe_key?: string
          entity_id?: string | null
          entity_type?: string | null
          error_redacted?: string | null
          id?: string
          metadata?: Json
          operation_id?: string
          org_id?: string
          provider_message_id?: string | null
          provider_timestamp?: string | null
          purpose?: string
          recipient_membership_id?: string
          status?: string
          to_e164?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "operational_messages_connection_id_org_id_fkey"
            columns: ["connection_id", "org_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_connections"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "operational_messages_operation_id_org_id_fkey"
            columns: ["operation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "operational_messages_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_messages_recipient_membership_id_org_id_fkey"
            columns: ["recipient_membership_id", "org_id"]
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
          amount_scope: string
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
          unit_quantity: number
          updated_at: string
          version: number
        }
        Insert: {
          ai_context?: string | null
          amount_scope?: string
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
          unit_quantity?: number
          updated_at?: string
          version?: number
        }
        Update: {
          ai_context?: string | null
          amount_scope?: string
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
          unit_quantity?: number
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
            foreignKeyName: "opportunities_current_conversation_id_fkey"
            columns: ["current_conversation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "opportunities_current_conversation_id_fkey"
            columns: ["current_conversation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "inbox_notification_counts"
            referencedColumns: ["conversation_id", "org_id"]
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
      opportunity_checklists: {
        Row: {
          completion: Json
          created_at: string
          id: string
          items_snapshot: Json
          opportunity_id: string
          org_id: string
          template_id: string
          template_version: number
          updated_at: string
        }
        Insert: {
          completion?: Json
          created_at?: string
          id?: string
          items_snapshot: Json
          opportunity_id: string
          org_id: string
          template_id: string
          template_version: number
          updated_at?: string
        }
        Update: {
          completion?: Json
          created_at?: string
          id?: string
          items_snapshot?: Json
          opportunity_id?: string
          org_id?: string
          template_id?: string
          template_version?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_checklists_opportunity_id_org_id_fkey"
            columns: ["opportunity_id", "org_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "opportunity_checklists_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_checklists_template_id_org_id_fkey"
            columns: ["template_id", "org_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
      opportunity_participant_requests: {
        Row: {
          action: string
          actor_user_id: string
          contact_id: string
          created_at: string
          id: string
          opportunity_id: string
          org_id: string
          processed_at: string
          role: string
        }
        Insert: {
          action: string
          actor_user_id?: string
          contact_id: string
          created_at?: string
          id?: string
          opportunity_id: string
          org_id: string
          processed_at?: string
          role?: string
        }
        Update: {
          action?: string
          actor_user_id?: string
          contact_id?: string
          created_at?: string
          id?: string
          opportunity_id?: string
          org_id?: string
          processed_at?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_participant_requests_contact_id_org_id_fkey"
            columns: ["contact_id", "org_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "opportunity_participant_requests_opportunity_id_org_id_fkey"
            columns: ["opportunity_id", "org_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "opportunity_participant_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
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
      opportunity_purchase_structure_requests: {
        Row: {
          actor_user_id: string
          amount_scope: string
          created_at: string
          id: string
          opportunity_id: string
          org_id: string
          processed_at: string
          unit_quantity: number
        }
        Insert: {
          actor_user_id?: string
          amount_scope: string
          created_at?: string
          id?: string
          opportunity_id: string
          org_id: string
          processed_at?: string
          unit_quantity: number
        }
        Update: {
          actor_user_id?: string
          amount_scope?: string
          created_at?: string
          id?: string
          opportunity_id?: string
          org_id?: string
          processed_at?: string
          unit_quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_purchase_structure_reque_opportunity_id_org_id_fkey"
            columns: ["opportunity_id", "org_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "opportunity_purchase_structure_requests_org_id_fkey"
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
          sale_unit_quantity: number | null
          sale_unit_reference: string | null
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
          sale_unit_quantity?: number | null
          sale_unit_reference?: string | null
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
          sale_unit_quantity?: number | null
          sale_unit_reference?: string | null
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
      opt_outs: {
        Row: {
          channel: string
          contact_id: string
          id: string
          operation_id: string
          org_id: string
          reason: string | null
          recorded_at: string
          recorded_by: string | null
          revoked_at: string | null
          revoked_by: string | null
          source: string
        }
        Insert: {
          channel?: string
          contact_id: string
          id?: string
          operation_id: string
          org_id: string
          reason?: string | null
          recorded_at?: string
          recorded_by?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          source: string
        }
        Update: {
          channel?: string
          contact_id?: string
          id?: string
          operation_id?: string
          org_id?: string
          reason?: string | null
          recorded_at?: string
          recorded_by?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "opt_outs_contact_id_org_id_fkey"
            columns: ["contact_id", "org_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "opt_outs_operation_id_org_id_fkey"
            columns: ["operation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "opt_outs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_bootstrap_requests: {
        Row: {
          access_request_id: string | null
          actor_user_id: string
          city: string | null
          created_at: string
          id: string
          membership_id: string | null
          operation_id: string | null
          operation_name: string
          organization_id: string | null
          organization_name: string
          processed_at: string | null
          result: string
          state: string | null
          timezone: string
        }
        Insert: {
          access_request_id?: string | null
          actor_user_id?: string
          city?: string | null
          created_at?: string
          id?: string
          membership_id?: string | null
          operation_id?: string | null
          operation_name: string
          organization_id?: string | null
          organization_name: string
          processed_at?: string | null
          result?: string
          state?: string | null
          timezone?: string
        }
        Update: {
          access_request_id?: string | null
          actor_user_id?: string
          city?: string | null
          created_at?: string
          id?: string
          membership_id?: string | null
          operation_id?: string | null
          operation_name?: string
          organization_id?: string | null
          organization_name?: string
          processed_at?: string | null
          result?: string
          state?: string | null
          timezone?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_bootstrap_requests_access_request_id_fkey"
            columns: ["access_request_id"]
            isOneToOne: false
            referencedRelation: "access_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_bootstrap_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_settings: {
        Row: {
          ai_global_mode: string
          ai_monthly_budget: number | null
          ai_monthly_budget_brl: number | null
          ai_usage_limits: Json
          brand_settings: Json
          created_at: string
          default_autonomy: string
          fallback_model_profile_id: string | null
          inbound_ai_mode: string
          institutional_profile: Json
          org_id: string
          reactivation_ai_mode: string
          reactivation_autonomy: string
          reactivation_release_state: string
          updated_at: string
        }
        Insert: {
          ai_global_mode?: string
          ai_monthly_budget?: number | null
          ai_monthly_budget_brl?: number | null
          ai_usage_limits?: Json
          brand_settings?: Json
          created_at?: string
          default_autonomy?: string
          fallback_model_profile_id?: string | null
          inbound_ai_mode?: string
          institutional_profile?: Json
          org_id: string
          reactivation_ai_mode?: string
          reactivation_autonomy?: string
          reactivation_release_state?: string
          updated_at?: string
        }
        Update: {
          ai_global_mode?: string
          ai_monthly_budget?: number | null
          ai_monthly_budget_brl?: number | null
          ai_usage_limits?: Json
          brand_settings?: Json
          created_at?: string
          default_autonomy?: string
          fallback_model_profile_id?: string | null
          inbound_ai_mode?: string
          institutional_profile?: Json
          org_id?: string
          reactivation_ai_mode?: string
          reactivation_autonomy?: string
          reactivation_release_state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_settings_fallback_model_fkey"
            columns: ["fallback_model_profile_id", "org_id"]
            isOneToOne: false
            referencedRelation: "model_profiles"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "organization_settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          archived_at: string | null
          archived_by: string | null
          city: string | null
          created_at: string
          id: string
          name: string
          slug: string
          state: string | null
          status: string
          suspended_at: string | null
          suspended_by: string | null
          suspension_public_message: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          archived_by?: string | null
          city?: string | null
          created_at?: string
          id?: string
          name: string
          slug: string
          state?: string | null
          status?: string
          suspended_at?: string | null
          suspended_by?: string | null
          suspension_public_message?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          archived_by?: string | null
          city?: string | null
          created_at?: string
          id?: string
          name?: string
          slug?: string
          state?: string | null
          status?: string
          suspended_at?: string | null
          suspended_by?: string | null
          suspension_public_message?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      ownership_transfer_requests: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          expires_at: string
          id: string
          org_id: string
          reauthenticated_at: string
          requested_by: string
          status: string
          target_membership_id: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          org_id: string
          reauthenticated_at: string
          requested_by?: string
          status?: string
          target_membership_id: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          org_id?: string
          reauthenticated_at?: string
          requested_by?: string
          status?: string
          target_membership_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ownership_transfer_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ownership_transfer_requests_target_membership_id_org_id_fkey"
            columns: ["target_membership_id", "org_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
      persona_publish_requests: {
        Row: {
          actor_user_id: string
          created_at: string
          id: string
          org_id: string
          persona_version_id: string
          processed_at: string
        }
        Insert: {
          actor_user_id?: string
          created_at?: string
          id?: string
          org_id: string
          persona_version_id: string
          processed_at?: string
        }
        Update: {
          actor_user_id?: string
          created_at?: string
          id?: string
          org_id?: string
          persona_version_id?: string
          processed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "persona_publish_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "persona_publish_requests_persona_version_id_org_id_fkey"
            columns: ["persona_version_id", "org_id"]
            isOneToOne: false
            referencedRelation: "persona_versions"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
      persona_samples: {
        Row: {
          created_at: string
          created_by: string
          extraction: Json
          id: string
          masked_text: string | null
          org_id: string
          persona_id: string
          purge_after: string
          raw_text: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          extraction?: Json
          id?: string
          masked_text?: string | null
          org_id: string
          persona_id: string
          purge_after?: string
          raw_text?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          extraction?: Json
          id?: string
          masked_text?: string | null
          org_id?: string
          persona_id?: string
          purge_after?: string
          raw_text?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "persona_samples_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "persona_samples_persona_id_org_id_fkey"
            columns: ["persona_id", "org_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
      persona_versions: {
        Row: {
          boundaries: Json
          checksum: string
          compiled_prompt: string
          created_at: string
          created_by: string | null
          escalation_rules: Json
          examples: Json
          id: string
          identity: Json
          org_id: string
          persona_id: string
          published_at: string | null
          published_by: string | null
          source_version_id: string | null
          status: string
          style: Json
          updated_at: string
          version: number
        }
        Insert: {
          boundaries?: Json
          checksum: string
          compiled_prompt: string
          created_at?: string
          created_by?: string | null
          escalation_rules?: Json
          examples?: Json
          id?: string
          identity?: Json
          org_id: string
          persona_id: string
          published_at?: string | null
          published_by?: string | null
          source_version_id?: string | null
          status?: string
          style?: Json
          updated_at?: string
          version: number
        }
        Update: {
          boundaries?: Json
          checksum?: string
          compiled_prompt?: string
          created_at?: string
          created_by?: string | null
          escalation_rules?: Json
          examples?: Json
          id?: string
          identity?: Json
          org_id?: string
          persona_id?: string
          published_at?: string | null
          published_by?: string | null
          source_version_id?: string | null
          status?: string
          style?: Json
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "persona_versions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "persona_versions_persona_id_org_id_fkey"
            columns: ["persona_id", "org_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "persona_versions_source_version_id_fkey"
            columns: ["source_version_id"]
            isOneToOne: false
            referencedRelation: "persona_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      personas: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          id: string
          identity_name: string
          name: string
          org_id: string
          status: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          identity_name: string
          name: string
          org_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          identity_name?: string
          name?: string
          org_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "personas_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
      platform_internal_messages: {
        Row: {
          actor_kind: string
          actor_user_id: string | null
          body: string
          created_at: string
          id: string
          metadata: Json
          thread_id: string
        }
        Insert: {
          actor_kind: string
          actor_user_id?: string | null
          body: string
          created_at?: string
          id?: string
          metadata?: Json
          thread_id: string
        }
        Update: {
          actor_kind?: string
          actor_user_id?: string | null
          body?: string
          created_at?: string
          id?: string
          metadata?: Json
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_internal_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "platform_internal_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_internal_threads: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          metadata: Json
          priority: string
          status: string
          thread_type: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json
          priority?: string
          status?: string
          thread_type?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json
          priority?: string
          status?: string
          thread_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      preleads: {
        Row: {
          consent_snapshot: Json
          contact_id: string | null
          created_at: string
          fields: Json
          id: string
          matched_at: string | null
          name: string | null
          operation_id: string
          opportunity_id: string | null
          org_id: string
          phone_e164: string | null
          status: string
          submission_id: string
        }
        Insert: {
          consent_snapshot: Json
          contact_id?: string | null
          created_at?: string
          fields?: Json
          id?: string
          matched_at?: string | null
          name?: string | null
          operation_id: string
          opportunity_id?: string | null
          org_id: string
          phone_e164?: string | null
          status: string
          submission_id: string
        }
        Update: {
          consent_snapshot?: Json
          contact_id?: string | null
          created_at?: string
          fields?: Json
          id?: string
          matched_at?: string | null
          name?: string | null
          operation_id?: string
          opportunity_id?: string | null
          org_id?: string
          phone_e164?: string | null
          status?: string
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "preleads_contact_id_org_id_fkey"
            columns: ["contact_id", "org_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "preleads_operation_id_org_id_fkey"
            columns: ["operation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "preleads_opportunity_id_org_id_fkey"
            columns: ["opportunity_id", "org_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "preleads_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preleads_submission_id_org_id_fkey"
            columns: ["submission_id", "org_id"]
            isOneToOne: false
            referencedRelation: "meta_lead_submissions"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
      privacy_action_requests: {
        Row: {
          action: string
          actor_user_id: string
          corrected_name: string | null
          created_at: string
          id: string
          identity_verified: boolean
          org_id: string
          privacy_request_id: string
          processed_at: string
          reason: string
          result: string | null
          retention_until: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string
          corrected_name?: string | null
          created_at?: string
          id?: string
          identity_verified?: boolean
          org_id: string
          privacy_request_id: string
          processed_at?: string
          reason: string
          result?: string | null
          retention_until?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string
          corrected_name?: string | null
          created_at?: string
          id?: string
          identity_verified?: boolean
          org_id?: string
          privacy_request_id?: string
          processed_at?: string
          reason?: string
          result?: string | null
          retention_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "privacy_action_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "privacy_action_requests_privacy_request_id_org_id_fkey"
            columns: ["privacy_request_id", "org_id"]
            isOneToOne: false
            referencedRelation: "privacy_requests"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
      privacy_requests: {
        Row: {
          completed_at: string | null
          contact_id: string
          created_at: string
          due_at: string
          execution_proof: Json | null
          export_snapshot: Json | null
          id: string
          legal_hold_reason: string | null
          org_id: string
          request_type: string
          requested_by: string | null
          resolution_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          contact_id: string
          created_at?: string
          due_at?: string
          execution_proof?: Json | null
          export_snapshot?: Json | null
          id?: string
          legal_hold_reason?: string | null
          org_id: string
          request_type: string
          requested_by?: string | null
          resolution_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          contact_id?: string
          created_at?: string
          due_at?: string
          execution_proof?: Json | null
          export_snapshot?: Json | null
          id?: string
          legal_hold_reason?: string | null
          org_id?: string
          request_type?: string
          requested_by?: string | null
          resolution_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "privacy_requests_contact_id_org_id_fkey"
            columns: ["contact_id", "org_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "privacy_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      privacy_review_requests: {
        Row: {
          action: string
          actor_user_id: string
          created_at: string
          id: string
          notes: string
          org_id: string
          privacy_request_id: string
          processed_at: string
          resulting_status: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string
          created_at?: string
          id?: string
          notes: string
          org_id: string
          privacy_request_id: string
          processed_at?: string
          resulting_status?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string
          created_at?: string
          id?: string
          notes?: string
          org_id?: string
          privacy_request_id?: string
          processed_at?: string
          resulting_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "privacy_review_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "privacy_review_requests_privacy_request_id_org_id_fkey"
            columns: ["privacy_request_id", "org_id"]
            isOneToOne: false
            referencedRelation: "privacy_requests"
            referencedColumns: ["id", "org_id"]
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
      project_fact_conflict_resolution_requests: {
        Row: {
          actor_user_id: string
          conflict_id: string
          created_at: string
          decision: string
          id: string
          org_id: string
          processed_at: string
          reason: string
          result: string | null
        }
        Insert: {
          actor_user_id?: string
          conflict_id: string
          created_at?: string
          decision: string
          id?: string
          org_id: string
          processed_at?: string
          reason: string
          result?: string | null
        }
        Update: {
          actor_user_id?: string
          conflict_id?: string
          created_at?: string
          decision?: string
          id?: string
          org_id?: string
          processed_at?: string
          reason?: string
          result?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_fact_conflict_resolution_requests_conflict_id_fkey"
            columns: ["conflict_id"]
            isOneToOne: false
            referencedRelation: "project_fact_conflicts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_fact_conflict_resolution_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      project_fact_conflicts: {
        Row: {
          code: string
          created_at: string
          created_by: string
          current_fact_id: string
          current_snapshot: Json
          id: string
          org_id: string
          project_id: string
          proposed_reference_date: string
          proposed_source_name: string
          proposed_unit: string | null
          proposed_valid_until: string | null
          proposed_value_number: number | null
          proposed_value_text: string | null
          resolution_reason: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string
          current_fact_id: string
          current_snapshot?: Json
          id?: string
          org_id: string
          project_id: string
          proposed_reference_date: string
          proposed_source_name: string
          proposed_unit?: string | null
          proposed_valid_until?: string | null
          proposed_value_number?: number | null
          proposed_value_text?: string | null
          resolution_reason?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string
          current_fact_id?: string
          current_snapshot?: Json
          id?: string
          org_id?: string
          project_id?: string
          proposed_reference_date?: string
          proposed_source_name?: string
          proposed_unit?: string | null
          proposed_valid_until?: string | null
          proposed_value_number?: number | null
          proposed_value_text?: string | null
          resolution_reason?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_fact_conflicts_current_fact_id_fkey"
            columns: ["current_fact_id"]
            isOneToOne: false
            referencedRelation: "project_facts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_fact_conflicts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_fact_conflicts_project_id_org_id_fkey"
            columns: ["project_id", "org_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
      project_facts: {
        Row: {
          active: boolean
          code: string
          confidence: number | null
          created_at: string
          id: string
          org_id: string
          project_id: string
          reference_date: string
          source_name: string
          unit: string | null
          updated_at: string
          valid_until: string | null
          value_number: number | null
          value_text: string | null
        }
        Insert: {
          active?: boolean
          code: string
          confidence?: number | null
          created_at?: string
          id?: string
          org_id: string
          project_id: string
          reference_date: string
          source_name: string
          unit?: string | null
          updated_at?: string
          valid_until?: string | null
          value_number?: number | null
          value_text?: string | null
        }
        Update: {
          active?: boolean
          code?: string
          confidence?: number | null
          created_at?: string
          id?: string
          org_id?: string
          project_id?: string
          reference_date?: string
          source_name?: string
          unit?: string | null
          updated_at?: string
          valid_until?: string | null
          value_number?: number | null
          value_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_facts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_facts_project_id_org_id_fkey"
            columns: ["project_id", "org_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
      project_match_requests: {
        Row: {
          actor_user_id: string | null
          created_at: string
          id: string
          opportunity_id: string
          org_id: string
          processed_at: string
          result_count: number
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          id?: string
          opportunity_id: string
          org_id: string
          processed_at?: string
          result_count?: number
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          id?: string
          opportunity_id?: string
          org_id?: string
          processed_at?: string
          result_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_match_requests_opportunity_id_org_id_fkey"
            columns: ["opportunity_id", "org_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "project_match_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      project_matches: {
        Row: {
          created_at: string
          criteria: Json
          decision_reason: string
          eligible: boolean
          id: string
          opportunity_id: string
          org_id: string
          project_id: string
          rank: number | null
          request_id: string
          sent_at: string | null
        }
        Insert: {
          created_at?: string
          criteria: Json
          decision_reason: string
          eligible: boolean
          id?: string
          opportunity_id: string
          org_id: string
          project_id: string
          rank?: number | null
          request_id: string
          sent_at?: string | null
        }
        Update: {
          created_at?: string
          criteria?: Json
          decision_reason?: string
          eligible?: boolean
          id?: string
          opportunity_id?: string
          org_id?: string
          project_id?: string
          rank?: number | null
          request_id?: string
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_matches_opportunity_id_org_id_fkey"
            columns: ["opportunity_id", "org_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "project_matches_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_matches_project_id_org_id_fkey"
            columns: ["project_id", "org_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
      project_media: {
        Row: {
          active: boolean
          created_at: string
          external_url: string | null
          id: string
          media_type: string
          mime_type: string | null
          org_id: string
          project_id: string
          published_at: string | null
          published_by: string | null
          size_bytes: number | null
          sort_order: number
          storage_path: string | null
          title: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          external_url?: string | null
          id?: string
          media_type: string
          mime_type?: string | null
          org_id: string
          project_id: string
          published_at?: string | null
          published_by?: string | null
          size_bytes?: number | null
          sort_order?: number
          storage_path?: string | null
          title?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          external_url?: string | null
          id?: string
          media_type?: string
          mime_type?: string | null
          org_id?: string
          project_id?: string
          published_at?: string | null
          published_by?: string | null
          size_bytes?: number | null
          sort_order?: number
          storage_path?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_media_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_media_project_id_org_id_fkey"
            columns: ["project_id", "org_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
      project_media_deliveries: {
        Row: {
          ai_execution_id: string
          created_at: string
          delivery_kind: string
          id: string
          message_id: string
          org_id: string
          project_media_id: string
        }
        Insert: {
          ai_execution_id: string
          created_at?: string
          delivery_kind: string
          id?: string
          message_id: string
          org_id: string
          project_media_id: string
        }
        Update: {
          ai_execution_id?: string
          created_at?: string
          delivery_kind?: string
          id?: string
          message_id?: string
          org_id?: string
          project_media_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_media_deliveries_ai_execution_id_org_id_fkey"
            columns: ["ai_execution_id", "org_id"]
            isOneToOne: false
            referencedRelation: "ai_executions"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "project_media_deliveries_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_media_deliveries_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_media_deliveries_project_media_id_fkey"
            columns: ["project_media_id"]
            isOneToOne: false
            referencedRelation: "project_media"
            referencedColumns: ["id"]
          },
        ]
      }
      project_media_uploads: {
        Row: {
          actor_user_id: string
          completed_at: string | null
          created_at: string
          error_redacted: string | null
          expires_at: string
          id: string
          media_id: string | null
          media_type: string
          mime_type: string
          org_id: string
          project_id: string
          size_bytes: number
          status: string
          storage_path: string
          title: string
        }
        Insert: {
          actor_user_id?: string
          completed_at?: string | null
          created_at?: string
          error_redacted?: string | null
          expires_at?: string
          id?: string
          media_id?: string | null
          media_type: string
          mime_type: string
          org_id: string
          project_id: string
          size_bytes: number
          status?: string
          storage_path: string
          title: string
        }
        Update: {
          actor_user_id?: string
          completed_at?: string | null
          created_at?: string
          error_redacted?: string | null
          expires_at?: string
          id?: string
          media_id?: string | null
          media_type?: string
          mime_type?: string
          org_id?: string
          project_id?: string
          size_bytes?: number
          status?: string
          storage_path?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_media_uploads_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "project_media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_media_uploads_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_media_uploads_project_id_org_id_fkey"
            columns: ["project_id", "org_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
      project_snapshots: {
        Row: {
          checksum: string
          created_at: string
          id: string
          opportunity_id: string | null
          org_id: string
          project_id: string
          snapshot: Json
        }
        Insert: {
          checksum: string
          created_at?: string
          id?: string
          opportunity_id?: string | null
          org_id: string
          project_id: string
          snapshot: Json
        }
        Update: {
          checksum?: string
          created_at?: string
          id?: string
          opportunity_id?: string | null
          org_id?: string
          project_id?: string
          snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "project_snapshots_opportunity_id_org_id_fkey"
            columns: ["opportunity_id", "org_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "project_snapshots_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_snapshots_project_id_org_id_fkey"
            columns: ["project_id", "org_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
      projects: {
        Row: {
          comfortable_installment: number | null
          commercial_priority: number
          cover_storage_path: string | null
          created_at: string
          created_by: string | null
          delivery_type: string
          id: string
          max_price: number | null
          min_down_payment: number | null
          min_price: number | null
          name: string
          neighborhood: string | null
          operation_id: string | null
          org_id: string
          primary_objective: string | null
          recommendable: boolean
          reference_date: string | null
          region: string
          short_stay_management: boolean | null
          source_name: string | null
          status: string
          summary: string
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          comfortable_installment?: number | null
          commercial_priority?: number
          cover_storage_path?: string | null
          created_at?: string
          created_by?: string | null
          delivery_type: string
          id?: string
          max_price?: number | null
          min_down_payment?: number | null
          min_price?: number | null
          name: string
          neighborhood?: string | null
          operation_id?: string | null
          org_id: string
          primary_objective?: string | null
          recommendable?: boolean
          reference_date?: string | null
          region: string
          short_stay_management?: boolean | null
          source_name?: string | null
          status?: string
          summary: string
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          comfortable_installment?: number | null
          commercial_priority?: number
          cover_storage_path?: string | null
          created_at?: string
          created_by?: string | null
          delivery_type?: string
          id?: string
          max_price?: number | null
          min_down_payment?: number | null
          min_price?: number | null
          name?: string
          neighborhood?: string | null
          operation_id?: string | null
          org_id?: string
          primary_objective?: string | null
          recommendable?: boolean
          reference_date?: string | null
          region?: string
          short_stay_management?: boolean | null
          source_name?: string | null
          status?: string
          summary?: string
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_operation_id_org_id_fkey"
            columns: ["operation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "projects_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth_key: string
          created_at: string
          endpoint: string
          id: string
          last_error_redacted: string | null
          last_success_at: string | null
          org_id: string
          p256dh: string
          revoked_at: string | null
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth_key: string
          created_at?: string
          endpoint: string
          id?: string
          last_error_redacted?: string | null
          last_success_at?: string | null
          org_id: string
          p256dh: string
          revoked_at?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth_key?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_error_redacted?: string | null
          last_success_at?: string | null
          org_id?: string
          p256dh?: string
          revoked_at?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      qualification_definitions: {
        Row: {
          accepted_interpretations: Json
          active: boolean
          answer_type: string
          applicability: Json
          clarification_rule: string | null
          code: string
          created_at: string
          description: string | null
          id: string
          intent: string
          name: string
          natural_examples: Json
          org_id: string
          priority: number
          required: boolean
          suggested_order: number
          updated_at: string
          validity_days: number | null
        }
        Insert: {
          accepted_interpretations?: Json
          active?: boolean
          answer_type: string
          applicability?: Json
          clarification_rule?: string | null
          code: string
          created_at?: string
          description?: string | null
          id?: string
          intent: string
          name: string
          natural_examples?: Json
          org_id: string
          priority?: number
          required?: boolean
          suggested_order: number
          updated_at?: string
          validity_days?: number | null
        }
        Update: {
          accepted_interpretations?: Json
          active?: boolean
          answer_type?: string
          applicability?: Json
          clarification_rule?: string | null
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          intent?: string
          name?: string
          natural_examples?: Json
          org_id?: string
          priority?: number
          required?: boolean
          suggested_order?: number
          updated_at?: string
          validity_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "qualification_definitions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      qualification_value_history: {
        Row: {
          actor_user_id: string | null
          confidence: number | null
          created_at: string
          definition_id: string
          id: string
          new_value: Json | null
          opportunity_id: string
          org_id: string
          previous_value: Json | null
          qualification_value_id: string | null
          result: string
          source: string
          source_message_id: string | null
        }
        Insert: {
          actor_user_id?: string | null
          confidence?: number | null
          created_at?: string
          definition_id: string
          id?: string
          new_value?: Json | null
          opportunity_id: string
          org_id: string
          previous_value?: Json | null
          qualification_value_id?: string | null
          result: string
          source: string
          source_message_id?: string | null
        }
        Update: {
          actor_user_id?: string | null
          confidence?: number | null
          created_at?: string
          definition_id?: string
          id?: string
          new_value?: Json | null
          opportunity_id?: string
          org_id?: string
          previous_value?: Json | null
          qualification_value_id?: string | null
          result?: string
          source?: string
          source_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qualification_value_history_definition_id_org_id_fkey"
            columns: ["definition_id", "org_id"]
            isOneToOne: false
            referencedRelation: "qualification_definitions"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "qualification_value_history_opportunity_id_org_id_fkey"
            columns: ["opportunity_id", "org_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "qualification_value_history_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qualification_value_history_qualification_value_id_org_id_fkey"
            columns: ["qualification_value_id", "org_id"]
            isOneToOne: false
            referencedRelation: "qualification_values"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "qualification_value_history_source_message_id_fkey"
            columns: ["source_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      qualification_value_requests: {
        Row: {
          actor_user_id: string | null
          confidence: number | null
          created_at: string
          definition_id: string
          expected_version: number | null
          human_confirmed: boolean
          id: string
          opportunity_id: string
          org_id: string
          processed_at: string
          qualification_value_id: string | null
          result: string | null
          source: string
          source_message_id: string | null
          state: string
          value_boolean: boolean | null
          value_json: Json | null
          value_number: number | null
          value_text: string | null
        }
        Insert: {
          actor_user_id?: string | null
          confidence?: number | null
          created_at?: string
          definition_id: string
          expected_version?: number | null
          human_confirmed?: boolean
          id?: string
          opportunity_id: string
          org_id: string
          processed_at?: string
          qualification_value_id?: string | null
          result?: string | null
          source: string
          source_message_id?: string | null
          state?: string
          value_boolean?: boolean | null
          value_json?: Json | null
          value_number?: number | null
          value_text?: string | null
        }
        Update: {
          actor_user_id?: string | null
          confidence?: number | null
          created_at?: string
          definition_id?: string
          expected_version?: number | null
          human_confirmed?: boolean
          id?: string
          opportunity_id?: string
          org_id?: string
          processed_at?: string
          qualification_value_id?: string | null
          result?: string | null
          source?: string
          source_message_id?: string | null
          state?: string
          value_boolean?: boolean | null
          value_json?: Json | null
          value_number?: number | null
          value_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qualification_value_requests_definition_id_org_id_fkey"
            columns: ["definition_id", "org_id"]
            isOneToOne: false
            referencedRelation: "qualification_definitions"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "qualification_value_requests_opportunity_id_org_id_fkey"
            columns: ["opportunity_id", "org_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "qualification_value_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qualification_value_requests_qualification_value_id_org_id_fkey"
            columns: ["qualification_value_id", "org_id"]
            isOneToOne: false
            referencedRelation: "qualification_values"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "qualification_value_requests_source_message_id_fkey"
            columns: ["source_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      qualification_values: {
        Row: {
          confidence: number | null
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          definition_id: string
          human_confirmed: boolean
          id: string
          opportunity_id: string
          org_id: string
          source: string
          source_message_id: string | null
          state: string
          updated_at: string
          valid_until: string | null
          value_boolean: boolean | null
          value_json: Json | null
          value_number: number | null
          value_text: string | null
          version: number
        }
        Insert: {
          confidence?: number | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          definition_id: string
          human_confirmed?: boolean
          id?: string
          opportunity_id: string
          org_id: string
          source: string
          source_message_id?: string | null
          state?: string
          updated_at?: string
          valid_until?: string | null
          value_boolean?: boolean | null
          value_json?: Json | null
          value_number?: number | null
          value_text?: string | null
          version?: number
        }
        Update: {
          confidence?: number | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          definition_id?: string
          human_confirmed?: boolean
          id?: string
          opportunity_id?: string
          org_id?: string
          source?: string
          source_message_id?: string | null
          state?: string
          updated_at?: string
          valid_until?: string | null
          value_boolean?: boolean | null
          value_json?: Json | null
          value_number?: number | null
          value_text?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "qualification_values_definition_id_org_id_fkey"
            columns: ["definition_id", "org_id"]
            isOneToOne: false
            referencedRelation: "qualification_definitions"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "qualification_values_opportunity_id_org_id_fkey"
            columns: ["opportunity_id", "org_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "qualification_values_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qualification_values_source_message_id_fkey"
            columns: ["source_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      qualification_versions: {
        Row: {
          checksum: string
          created_at: string
          definitions_snapshot: Json
          id: string
          org_id: string
          published_at: string | null
          published_by: string | null
          status: string
          version: number
        }
        Insert: {
          checksum: string
          created_at?: string
          definitions_snapshot: Json
          id?: string
          org_id: string
          published_at?: string | null
          published_by?: string | null
          status?: string
          version: number
        }
        Update: {
          checksum?: string
          created_at?: string
          definitions_snapshot?: Json
          id?: string
          org_id?: string
          published_at?: string | null
          published_by?: string | null
          status?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "qualification_versions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      regression_case_results: {
        Row: {
          actual_action: string | null
          case_id: string
          completed_at: string | null
          created_at: string
          error_redacted: string | null
          id: string
          org_id: string
          output_structured: Json | null
          output_text: string | null
          run_id: string
          started_at: string | null
          status: string
          violations: string[]
        }
        Insert: {
          actual_action?: string | null
          case_id: string
          completed_at?: string | null
          created_at?: string
          error_redacted?: string | null
          id?: string
          org_id: string
          output_structured?: Json | null
          output_text?: string | null
          run_id: string
          started_at?: string | null
          status?: string
          violations?: string[]
        }
        Update: {
          actual_action?: string | null
          case_id?: string
          completed_at?: string | null
          created_at?: string
          error_redacted?: string | null
          id?: string
          org_id?: string
          output_structured?: Json | null
          output_text?: string | null
          run_id?: string
          started_at?: string | null
          status?: string
          violations?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "regression_case_results_case_id_org_id_fkey"
            columns: ["case_id", "org_id"]
            isOneToOne: false
            referencedRelation: "regression_cases"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "regression_case_results_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regression_case_results_run_id_org_id_fkey"
            columns: ["run_id", "org_id"]
            isOneToOne: false
            referencedRelation: "regression_runs"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
      regression_cases: {
        Row: {
          active: boolean
          allowed_actions: string[]
          created_at: string
          created_by: string | null
          expected_response: string | null
          id: string
          initial_state: Json
          org_id: string
          prohibited_actions: string[]
          rubric: Json
          severity: string
          simulated_input: string
          source: string
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          allowed_actions?: string[]
          created_at?: string
          created_by?: string | null
          expected_response?: string | null
          id?: string
          initial_state?: Json
          org_id: string
          prohibited_actions?: string[]
          rubric?: Json
          severity?: string
          simulated_input: string
          source: string
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          allowed_actions?: string[]
          created_at?: string
          created_by?: string | null
          expected_response?: string | null
          id?: string
          initial_state?: Json
          org_id?: string
          prohibited_actions?: string[]
          rubric?: Json
          severity?: string
          simulated_input?: string
          source?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "regression_cases_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      regression_run_requests: {
        Row: {
          actor_user_id: string
          created_at: string
          id: string
          org_id: string
          processed_at: string
          run_id: string | null
          total_cases: number
        }
        Insert: {
          actor_user_id?: string
          created_at?: string
          id?: string
          org_id: string
          processed_at?: string
          run_id?: string | null
          total_cases?: number
        }
        Update: {
          actor_user_id?: string
          created_at?: string
          id?: string
          org_id?: string
          processed_at?: string
          run_id?: string | null
          total_cases?: number
        }
        Relationships: [
          {
            foreignKeyName: "regression_run_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regression_run_requests_run_id_org_id_fkey"
            columns: ["run_id", "org_id"]
            isOneToOne: false
            referencedRelation: "regression_runs"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
      regression_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          critical_failures: number
          id: string
          org_id: string
          passed_cases: number
          results: Json
          rule_version_id: string
          status: string
          total_cases: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          critical_failures?: number
          id?: string
          org_id: string
          passed_cases?: number
          results?: Json
          rule_version_id: string
          status?: string
          total_cases?: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          critical_failures?: number
          id?: string
          org_id?: string
          passed_cases?: number
          results?: Json
          rule_version_id?: string
          status?: string
          total_cases?: number
        }
        Relationships: [
          {
            foreignKeyName: "regression_runs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regression_runs_rule_version_id_org_id_fkey"
            columns: ["rule_version_id", "org_id"]
            isOneToOne: false
            referencedRelation: "rule_versions"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
      retention_policies: {
        Row: {
          action: string
          active: boolean
          automatic_enabled: boolean
          created_at: string
          data_class: string
          id: string
          org_id: string
          retention_days: number
          updated_at: string
        }
        Insert: {
          action: string
          active?: boolean
          automatic_enabled?: boolean
          created_at?: string
          data_class: string
          id?: string
          org_id: string
          retention_days: number
          updated_at?: string
        }
        Update: {
          action?: string
          active?: boolean
          automatic_enabled?: boolean
          created_at?: string
          data_class?: string
          id?: string
          org_id?: string
          retention_days?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "retention_policies_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      rule_publish_requests: {
        Row: {
          actor_user_id: string
          created_at: string
          id: string
          org_id: string
          processed_at: string
          rule_version_id: string
        }
        Insert: {
          actor_user_id?: string
          created_at?: string
          id?: string
          org_id: string
          processed_at?: string
          rule_version_id: string
        }
        Update: {
          actor_user_id?: string
          created_at?: string
          id?: string
          org_id?: string
          processed_at?: string
          rule_version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rule_publish_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rule_publish_requests_rule_version_id_org_id_fkey"
            columns: ["rule_version_id", "org_id"]
            isOneToOne: false
            referencedRelation: "rule_versions"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
      rule_sets: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          org_id: string
          status: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
          org_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          org_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rule_sets_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      rule_versions: {
        Row: {
          checksum: string
          compiled_rules: Json
          created_at: string
          created_by: string | null
          id: string
          org_id: string
          published_at: string | null
          published_by: string | null
          rule_set_id: string
          rules: Json
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          checksum: string
          compiled_rules: Json
          created_at?: string
          created_by?: string | null
          id?: string
          org_id: string
          published_at?: string | null
          published_by?: string | null
          rule_set_id: string
          rules: Json
          status?: string
          updated_at?: string
          version: number
        }
        Update: {
          checksum?: string
          compiled_rules?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          org_id?: string
          published_at?: string | null
          published_by?: string | null
          rule_set_id?: string
          rules?: Json
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "rule_versions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rule_versions_rule_set_id_org_id_fkey"
            columns: ["rule_set_id", "org_id"]
            isOneToOne: false
            referencedRelation: "rule_sets"
            referencedColumns: ["id", "org_id"]
          },
        ]
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
          unit_quantity: number
          unit_reference: string | null
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
          unit_quantity?: number
          unit_reference?: string | null
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
          unit_quantity?: number
          unit_reference?: string | null
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
      scheduled_job_requests: {
        Row: {
          actor_user_id: string
          aggregate_id: string | null
          aggregate_type: string
          created_at: string
          dedupe_key: string
          id: string
          job_id: string | null
          job_type: string
          max_attempts: number
          operation_id: string | null
          org_id: string
          payload: Json
          processed_at: string
          run_at: string
          target_queue: string
        }
        Insert: {
          actor_user_id?: string
          aggregate_id?: string | null
          aggregate_type: string
          created_at?: string
          dedupe_key: string
          id?: string
          job_id?: string | null
          job_type: string
          max_attempts?: number
          operation_id?: string | null
          org_id: string
          payload?: Json
          processed_at?: string
          run_at: string
          target_queue: string
        }
        Update: {
          actor_user_id?: string
          aggregate_id?: string | null
          aggregate_type?: string
          created_at?: string
          dedupe_key?: string
          id?: string
          job_id?: string | null
          job_type?: string
          max_attempts?: number
          operation_id?: string | null
          org_id?: string
          payload?: Json
          processed_at?: string
          run_at?: string
          target_queue?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_job_requests_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "scheduled_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_job_requests_operation_id_org_id_fkey"
            columns: ["operation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "scheduled_job_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_jobs: {
        Row: {
          aggregate_id: string | null
          aggregate_type: string
          attempts: number
          completed_at: string | null
          created_at: string
          created_by: string | null
          dedupe_key: string
          id: string
          job_type: string
          last_error: string | null
          lease_until: string | null
          max_attempts: number
          operation_id: string | null
          org_id: string
          payload: Json
          run_at: string
          status: string
          target_queue: string
          updated_at: string
        }
        Insert: {
          aggregate_id?: string | null
          aggregate_type: string
          attempts?: number
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          dedupe_key: string
          id?: string
          job_type: string
          last_error?: string | null
          lease_until?: string | null
          max_attempts?: number
          operation_id?: string | null
          org_id: string
          payload?: Json
          run_at: string
          status?: string
          target_queue: string
          updated_at?: string
        }
        Update: {
          aggregate_id?: string | null
          aggregate_type?: string
          attempts?: number
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          dedupe_key?: string
          id?: string
          job_type?: string
          last_error?: string | null
          lease_until?: string | null
          max_attempts?: number
          operation_id?: string | null
          org_id?: string
          payload?: Json
          run_at?: string
          status?: string
          target_queue?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_jobs_operation_id_org_id_fkey"
            columns: ["operation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "scheduled_jobs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      simulator_run_requests: {
        Row: {
          actor_user_id: string
          created_at: string
          id: string
          initial_state: Json
          operation_id: string | null
          org_id: string
          processed_at: string
          session_id: string | null
          simulated_input: string
          simulator_run_id: string | null
          title: string
        }
        Insert: {
          actor_user_id?: string
          created_at?: string
          id?: string
          initial_state?: Json
          operation_id?: string | null
          org_id: string
          processed_at?: string
          session_id?: string | null
          simulated_input: string
          simulator_run_id?: string | null
          title: string
        }
        Update: {
          actor_user_id?: string
          created_at?: string
          id?: string
          initial_state?: Json
          operation_id?: string | null
          org_id?: string
          processed_at?: string
          session_id?: string | null
          simulated_input?: string
          simulator_run_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulator_run_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulator_run_requests_session_org_fkey"
            columns: ["session_id", "org_id"]
            isOneToOne: false
            referencedRelation: "simulator_sessions"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
      simulator_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string
          execution_id: string | null
          id: string
          initial_state: Json
          operation_id: string | null
          org_id: string
          output_structured: Json | null
          output_text: string | null
          session_id: string
          simulated_input: string
          status: string
          title: string
          turn_index: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by: string
          execution_id?: string | null
          id?: string
          initial_state?: Json
          operation_id?: string | null
          org_id: string
          output_structured?: Json | null
          output_text?: string | null
          session_id: string
          simulated_input: string
          status: string
          title: string
          turn_index: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string
          execution_id?: string | null
          id?: string
          initial_state?: Json
          operation_id?: string | null
          org_id?: string
          output_structured?: Json | null
          output_text?: string | null
          session_id?: string
          simulated_input?: string
          status?: string
          title?: string
          turn_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "simulator_runs_execution_id_org_id_fkey"
            columns: ["execution_id", "org_id"]
            isOneToOne: false
            referencedRelation: "ai_executions"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "simulator_runs_operation_id_org_id_fkey"
            columns: ["operation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "simulator_runs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulator_runs_session_org_fkey"
            columns: ["session_id", "org_id"]
            isOneToOne: false
            referencedRelation: "simulator_sessions"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
      simulator_session_requests: {
        Row: {
          action: string
          actor_user_id: string
          created_at: string
          id: string
          org_id: string
          processed_at: string
          result: string | null
          session_id: string
        }
        Insert: {
          action: string
          actor_user_id?: string
          created_at?: string
          id?: string
          org_id: string
          processed_at?: string
          result?: string | null
          session_id: string
        }
        Update: {
          action?: string
          actor_user_id?: string
          created_at?: string
          id?: string
          org_id?: string
          processed_at?: string
          result?: string | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulator_session_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulator_session_requests_session_id_org_id_fkey"
            columns: ["session_id", "org_id"]
            isOneToOne: false
            referencedRelation: "simulator_sessions"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
      simulator_sessions: {
        Row: {
          archived_at: string | null
          archived_by: string | null
          created_at: string
          created_by: string
          id: string
          initial_state: Json
          last_activity_at: string
          operation_id: string | null
          org_id: string
          status: string
          title: string
          turn_count: number
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          created_by?: string
          id?: string
          initial_state?: Json
          last_activity_at?: string
          operation_id?: string | null
          org_id: string
          status?: string
          title: string
          turn_count?: number
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          created_by?: string
          id?: string
          initial_state?: Json
          last_activity_at?: string
          operation_id?: string | null
          org_id?: string
          status?: string
          title?: string
          turn_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulator_sessions_operation_id_org_id_fkey"
            columns: ["operation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "simulator_sessions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
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
      suppression_entries: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          operation_id: string
          org_id: string
          phone_e164: string
          reason: string
          revoked_at: string | null
          source: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          operation_id: string
          org_id: string
          phone_e164: string
          reason: string
          revoked_at?: string | null
          source: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          operation_id?: string
          org_id?: string
          phone_e164?: string
          reason?: string
          revoked_at?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppression_entries_operation_id_org_id_fkey"
            columns: ["operation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "suppression_entries_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      system_pauses: {
        Row: {
          active: boolean
          id: string
          metadata: Json
          operation_id: string | null
          org_id: string
          paused_at: string
          paused_by: string | null
          reason: string
          resumed_at: string | null
          resumed_by: string | null
          scope_id: string | null
          scope_type: string
          source: string
        }
        Insert: {
          active?: boolean
          id?: string
          metadata?: Json
          operation_id?: string | null
          org_id: string
          paused_at?: string
          paused_by?: string | null
          reason: string
          resumed_at?: string | null
          resumed_by?: string | null
          scope_id?: string | null
          scope_type: string
          source: string
        }
        Update: {
          active?: boolean
          id?: string
          metadata?: Json
          operation_id?: string | null
          org_id?: string
          paused_at?: string
          paused_by?: string | null
          reason?: string
          resumed_at?: string | null
          resumed_by?: string | null
          scope_id?: string | null
          scope_type?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_pauses_operation_id_org_id_fkey"
            columns: ["operation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "system_pauses_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_ledger: {
        Row: {
          estimated_cost: number
          estimated_cost_brl: number
          execution_id: string | null
          fx_rate_to_brl: number | null
          id: number
          input_tokens: number
          model_identifier: string
          operation_id: string | null
          org_id: string
          output_tokens: number
          provider_cost_original: number
          provider_currency: string
          recorded_at: string
          usage_type: string
        }
        Insert: {
          estimated_cost?: number
          estimated_cost_brl?: number
          execution_id?: string | null
          fx_rate_to_brl?: number | null
          id?: never
          input_tokens?: number
          model_identifier: string
          operation_id?: string | null
          org_id: string
          output_tokens?: number
          provider_cost_original?: number
          provider_currency?: string
          recorded_at?: string
          usage_type: string
        }
        Update: {
          estimated_cost?: number
          estimated_cost_brl?: number
          execution_id?: string | null
          fx_rate_to_brl?: number | null
          id?: never
          input_tokens?: number
          model_identifier?: string
          operation_id?: string | null
          org_id?: string
          output_tokens?: number
          provider_cost_original?: number
          provider_currency?: string
          recorded_at?: string
          usage_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_ledger_execution_id_org_id_fkey"
            columns: ["execution_id", "org_id"]
            isOneToOne: false
            referencedRelation: "ai_executions"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "usage_ledger_operation_id_org_id_fkey"
            columns: ["operation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "usage_ledger_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_ingest_requests: {
        Row: {
          body: string | null
          connection_id: string
          contact_name: string | null
          content_type: string
          conversation_id: string | null
          created_at: string
          duplicate: boolean
          external_event_id: string
          from_e164: string
          id: string
          message_id: string | null
          org_id: string
          payload: Json
          payload_sha256: string
          processed_at: string
          provider_message_id: string
          provider_timestamp: string | null
        }
        Insert: {
          body?: string | null
          connection_id: string
          contact_name?: string | null
          content_type?: string
          conversation_id?: string | null
          created_at?: string
          duplicate?: boolean
          external_event_id: string
          from_e164: string
          id?: string
          message_id?: string | null
          org_id: string
          payload?: Json
          payload_sha256: string
          processed_at?: string
          provider_message_id: string
          provider_timestamp?: string | null
        }
        Update: {
          body?: string | null
          connection_id?: string
          contact_name?: string | null
          content_type?: string
          conversation_id?: string | null
          created_at?: string
          duplicate?: boolean
          external_event_id?: string
          from_e164?: string
          id?: string
          message_id?: string | null
          org_id?: string
          payload?: Json
          payload_sha256?: string
          processed_at?: string
          provider_message_id?: string
          provider_timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_ingest_requests_connection_id_org_id_fkey"
            columns: ["connection_id", "org_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_connections"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "webhook_ingest_requests_conversation_id_org_id_fkey"
            columns: ["conversation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "webhook_ingest_requests_conversation_id_org_id_fkey"
            columns: ["conversation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "inbox_notification_counts"
            referencedColumns: ["conversation_id", "org_id"]
          },
          {
            foreignKeyName: "webhook_ingest_requests_message_id_org_id_fkey"
            columns: ["message_id", "org_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "webhook_ingest_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_connections: {
        Row: {
          campaign_enabled: boolean
          created_at: string
          created_by: string | null
          endpoint_url: string | null
          id: string
          inbound_enabled: boolean
          integration_account_id: string | null
          last_error_redacted: string | null
          last_health_at: string | null
          name: string
          operation_id: string
          org_id: string
          outbound_pause_reason: string | null
          outbound_paused: boolean
          outbound_paused_at: string | null
          phone_e164: string | null
          provider: string
          secret_reference: string | null
          settings: Json
          status: string
          updated_at: string
          visible_profile_name: string | null
        }
        Insert: {
          campaign_enabled?: boolean
          created_at?: string
          created_by?: string | null
          endpoint_url?: string | null
          id?: string
          inbound_enabled?: boolean
          integration_account_id?: string | null
          last_error_redacted?: string | null
          last_health_at?: string | null
          name: string
          operation_id: string
          org_id: string
          outbound_pause_reason?: string | null
          outbound_paused?: boolean
          outbound_paused_at?: string | null
          phone_e164?: string | null
          provider: string
          secret_reference?: string | null
          settings?: Json
          status?: string
          updated_at?: string
          visible_profile_name?: string | null
        }
        Update: {
          campaign_enabled?: boolean
          created_at?: string
          created_by?: string | null
          endpoint_url?: string | null
          id?: string
          inbound_enabled?: boolean
          integration_account_id?: string | null
          last_error_redacted?: string | null
          last_health_at?: string | null
          name?: string
          operation_id?: string
          org_id?: string
          outbound_pause_reason?: string | null
          outbound_paused?: boolean
          outbound_paused_at?: string | null
          phone_e164?: string | null
          provider?: string
          secret_reference?: string | null
          settings?: Json
          status?: string
          updated_at?: string
          visible_profile_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_connections_integration_account_id_fkey"
            columns: ["integration_account_id", "org_id"]
            isOneToOne: false
            referencedRelation: "integration_accounts"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "whatsapp_connections_operation_id_org_id_fkey"
            columns: ["operation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "whatsapp_connections_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_message_templates: {
        Row: {
          category: string | null
          components: Json
          connection_id: string
          created_at: string
          enabled: boolean
          external_name: string
          id: string
          language: string
          last_synced_at: string
          operation_id: string
          org_id: string
          parameter_strategy: string
          provider_status: string
          purpose: string | null
          updated_at: string
          variable_count: number
        }
        Insert: {
          category?: string | null
          components?: Json
          connection_id: string
          created_at?: string
          enabled?: boolean
          external_name: string
          id?: string
          language: string
          last_synced_at?: string
          operation_id: string
          org_id: string
          parameter_strategy?: string
          provider_status: string
          purpose?: string | null
          updated_at?: string
          variable_count?: number
        }
        Update: {
          category?: string | null
          components?: Json
          connection_id?: string
          created_at?: string
          enabled?: boolean
          external_name?: string
          id?: string
          language?: string
          last_synced_at?: string
          operation_id?: string
          org_id?: string
          parameter_strategy?: string
          provider_status?: string
          purpose?: string | null
          updated_at?: string
          variable_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_message_templates_connection_id_org_id_fkey"
            columns: ["connection_id", "org_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_connections"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "whatsapp_message_templates_operation_id_org_id_fkey"
            columns: ["operation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "whatsapp_message_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      inbox_notification_counts: {
        Row: {
          conversation_id: string | null
          org_id: string | null
          pending_suggestion_count: number | null
          total_count: number | null
          unread_inbound_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      apply_inbound_control_intent: {
        Args: { p_intent: string; p_message_id: string }
        Returns: Json
      }
      apply_inbound_control_intent_before_behavior_v3: {
        Args: { p_intent: string; p_message_id: string }
        Returns: Json
      }
      apply_provider_message_mutation: {
        Args: {
          p_body?: string
          p_connection_id: string
          p_emoji?: string
          p_external_event_id: string
          p_kind: string
          p_provider_timestamp?: string
          p_target_provider_message_id: string
        }
        Returns: Json
      }
      apply_provider_message_status: {
        Args: {
          p_connection_id: string
          p_error_redacted?: string
          p_provider_message_id: string
          p_provider_timestamp?: string
          p_status: string
        }
        Returns: boolean
      }
      assign_experiment_variant: {
        Args: {
          p_conversation_id?: string
          p_experiment_id: string
          p_opportunity_id: string
        }
        Returns: string
      }
      block_outbound_template_missing: {
        Args: { p_message_id: string }
        Returns: undefined
      }
      cancel_access_request: {
        Args: { p_request_id: string }
        Returns: undefined
      }
      claim_inbound_media: { Args: { p_message_id: string }; Returns: Json }
      claim_outbound_message: { Args: { p_message_id: string }; Returns: Json }
      claim_platform_push_notifications: {
        Args: { p_limit?: number }
        Returns: Json
      }
      claim_regression_case: {
        Args: { p_case_id: string; p_run_id: string }
        Returns: Json
      }
      claim_retention_purge: {
        Args: { p_limit?: number }
        Returns: {
          action: string
          entity_id: string
          entity_type: string
          id: string
          org_id: string
          storage_bucket: string
          storage_path: string
        }[]
      }
      complete_ai_execution: {
        Args: {
          p_execution_id: string
          p_input_tokens: number
          p_latency_ms: number
          p_model_returned: string
          p_output_structured: Json
          p_output_text: string
          p_output_tokens: number
          p_response_id: string
        }
        Returns: Json
      }
      complete_inbound_media: {
        Args: {
          p_error_redacted?: string
          p_extracted_text?: string
          p_message_id: string
          p_mime_type: string
          p_sha256: string
          p_size_bytes: number
          p_storage_bucket: string
          p_storage_path: string
        }
        Returns: string
      }
      complete_outbound_message: {
        Args: {
          p_message_id: string
          p_provider_message_id: string
          p_provider_timestamp?: string
        }
        Returns: undefined
      }
      complete_pedro_turn: {
        Args: {
          p_execution_id: string
          p_input_tokens: number
          p_latency_ms: number
          p_model_returned: string
          p_output_structured: Json
          p_output_text: string
          p_output_tokens: number
          p_response_id: string
        }
        Returns: Json
      }
      complete_regression_case: {
        Args: {
          p_actual_action: string
          p_error_redacted?: string
          p_output_structured: Json
          p_output_text: string
          p_result_id: string
          p_violations: string[]
        }
        Returns: string
      }
      configure_runtime_worker: {
        Args: { p_base_url: string; p_worker_secret: string }
        Returns: undefined
      }
      consume_runtime_event: { Args: { p_event: Json }; Returns: Json }
      current_access_block: {
        Args: never
        Returns: {
          block_type: string
          public_message: string
        }[]
      }
      current_platform_context: {
        Args: never
        Returns: {
          role: string
          status: string
        }[]
      }
      decide_access_request: {
        Args: {
          p_approved_role?: string
          p_confirmation?: string
          p_decision: string
          p_internal_note?: string
          p_operation_ids?: string[]
          p_public_reason?: string
          p_request_id: string
        }
        Returns: string
      }
      dispatch_runtime_sources: {
        Args: { p_batch_size?: number }
        Returns: Json
      }
      enqueue_pedro_project_media: {
        Args: { p_execution_id: string }
        Returns: number
      }
      get_pedro_available_call_slots: {
        Args: {
          p_from?: string
          p_limit?: number
          p_operation_id: string
          p_to?: string
        }
        Returns: Json
      }
      enqueue_storage_retention: {
        Args: {
          p_bucket: string
          p_due_at: string
          p_entity_id: string
          p_entity_type: string
          p_org_id: string
          p_path: string
        }
        Returns: undefined
      }
      ensure_inbound_ai_execution: {
        Args: { p_message_id: string }
        Returns: Json
      }
      ensure_internal_general_thread: {
        Args: { p_assistant_role: string; p_operation_id: string }
        Returns: string
      }
      execute_runtime_job: { Args: { p_job_id: string }; Returns: Json }
      execute_runtime_job_before_behavior_v3: {
        Args: { p_job_id: string }
        Returns: Json
      }
      execute_runtime_job_before_grill_close: {
        Args: { p_job_id: string }
        Returns: Json
      }
      execute_runtime_job_before_p0: {
        Args: { p_job_id: string }
        Returns: Json
      }
      execute_runtime_job_before_regression_fix: {
        Args: { p_job_id: string }
        Returns: Json
      }
      execute_runtime_job_phase12: { Args: { p_job_id: string }; Returns: Json }
      execute_runtime_job_phase13: { Args: { p_job_id: string }; Returns: Json }
      execute_runtime_job_phase14: { Args: { p_job_id: string }; Returns: Json }
      execute_runtime_job_phase16: { Args: { p_job_id: string }; Returns: Json }
      fail_ai_execution: {
        Args: {
          p_error_code: string
          p_error_redacted: string
          p_execution_id: string
        }
        Returns: undefined
      }
      fail_outbound_message: {
        Args: {
          p_error_code: string
          p_error_redacted: string
          p_message_id: string
        }
        Returns: undefined
      }
      finish_platform_push_notification: {
        Args: {
          p_delivered: boolean
          p_notification_id: string
          p_revoke_subscription?: boolean
          p_subscription_id?: string
        }
        Returns: undefined
      }
      finish_retention_purge: {
        Args: { p_error_redacted?: string; p_id: string; p_success: boolean }
        Returns: undefined
      }
      finish_runtime_job: {
        Args: {
          p_error_redacted?: string
          p_job_id: string
          p_retry_seconds?: number
          p_success: boolean
        }
        Returns: string
      }
      get_integration_secret: {
        Args: { p_integration_account_id: string }
        Returns: string
      }
      get_outbound_template: { Args: { p_message_id: string }; Returns: Json }
      invitation_preview: {
        Args: { p_token_hash: string }
        Returns: {
          email_matches: boolean
          expires_at: string
          invitation_status: string
          invited_email_masked: string
          invited_role: string
          operation_name: string
          organization_name: string
        }[]
      }
      list_audit_events: {
        Args: { p_limit?: number; p_org_id: string }
        Returns: {
          action: string
          actor_type: string
          actor_user_id: string
          entity_id: string
          entity_type: string
          id: string
          metadata: Json
          occurred_at: string
          operation_id: string
        }[]
      }
      log_support_access: {
        Args: {
          p_action: string
          p_entity_id?: string
          p_entity_type: string
          p_metadata?: Json
          p_org_id: string
        }
        Returns: undefined
      }
      lookup_organization_join_code: {
        Args: { p_code: string }
        Returns: {
          city: string
          org_id: string
          organization_name: string
          state: string
        }[]
      }
      mark_internal_thread_read: {
        Args: { p_thread_id: string }
        Returns: undefined
      }
      organization_has_external_support: { Args: never; Returns: boolean }
      organization_join_code: {
        Args: never
        Returns: {
          code: string
          enabled: boolean
          generated_at: string
        }[]
      }
      platform_add_access_request_note: {
        Args: { p_note: string; p_request_id: string }
        Returns: undefined
      }
      platform_control_organization: {
        Args: {
          p_action: string
          p_confirmation: string
          p_internal_note: string
          p_org_id: string
          p_public_message: string
        }
        Returns: string
      }
      platform_control_snapshot: { Args: never; Returns: Json }
      platform_control_user: {
        Args: {
          p_action: string
          p_confirmation: string
          p_internal_note: string
          p_public_message: string
          p_user_id: string
        }
        Returns: string
      }
      platform_manage_principal: {
        Args: {
          p_action: string
          p_confirmation: string
          p_role: string
          p_user_id: string
        }
        Returns: string
      }
      platform_manage_support_grant: {
        Args: {
          p_access_level: string
          p_action: string
          p_confirmation: string
          p_contract_reference: string
          p_expires_at: string
          p_org_id: string
        }
        Returns: string
      }
      platform_organization_metrics: {
        Args: never
        Returns: {
          active_connections: number
          active_members: number
          last_activity_at: string
          open_opportunities: number
          org_id: string
          organization_name: string
          status: string
        }[]
      }
      platform_preauthorize_organization: {
        Args: { p_action: string; p_confirmation: string; p_email: string }
        Returns: string
      }
      platform_user_directory: { Args: never; Returns: Json }
      process_operational_whatsapp_reply: {
        Args: {
          p_body: string
          p_connection_id: string
          p_external_event_id: string
          p_from_e164: string
        }
        Returns: Json
      }
      record_access_rate_event: {
        Args: { p_event_type: string; p_ip_hash: string; p_user_id: string }
        Returns: undefined
      }
      recover_stalled_inbound_ai: { Args: { p_limit?: number }; Returns: Json }
      register_platform_invitation: {
        Args: {
          p_created_by: string
          p_email: string
          p_expires_at: string
          p_role: string
          p_user_id: string
        }
        Returns: string
      }
      resubmit_access_request: {
        Args: {
          p_approximate_brokers?: number
          p_city?: string
          p_cnpj?: string
          p_creci?: string
          p_introduction?: string
          p_operation_description?: string
          p_organization_name?: string
          p_request_id: string
          p_state?: string
          p_whatsapp_e164: string
        }
        Returns: undefined
      }
      retry_ai_execution: {
        Args: {
          p_error_code: string
          p_error_redacted: string
          p_execution_id: string
        }
        Returns: boolean
      }
      revoke_external_support_access: {
        Args: { p_confirmation: string }
        Returns: number
      }
      revoke_integration_account: {
        Args: {
          p_actor_user_id: string
          p_integration_account_id: string
          p_org_id: string
        }
        Returns: undefined
      }
      rotate_organization_join_code: {
        Args: { p_action: string; p_confirmation: string; p_reason: string }
        Returns: string
      }
      runtime_queue_archive: {
        Args: { p_msg_id: number; p_queue_name: string }
        Returns: boolean
      }
      runtime_queue_dead_letter: {
        Args: {
          p_error_code: string
          p_error_redacted: string
          p_msg_id: number
          p_payload: Json
          p_queue_name: string
          p_read_count: number
        }
        Returns: string
      }
      runtime_queue_read: {
        Args: {
          p_limit?: number
          p_queue_name: string
          p_visibility_timeout?: number
        }
        Returns: {
          enqueued_at: string
          message: Json
          msg_id: number
          read_ct: number
          vt: string
        }[]
      }
      runtime_queue_retry: {
        Args: {
          p_delay_seconds: number
          p_msg_id: number
          p_queue_name: string
        }
        Returns: boolean
      }
      schedule_inbound_ai_aggregation: {
        Args: { p_message_id: string }
        Returns: Json
      }
      start_ai_execution: { Args: { p_execution_id: string }; Returns: boolean }
      store_conversation_summary: {
        Args: {
          p_conversation_id: string
          p_facts: Json
          p_source_execution_id: string
          p_summary: string
        }
        Returns: string
      }
      store_openai_integration: {
        Args: {
          p_actor_user_id: string
          p_credential_hint: string
          p_latency_ms: number
          p_model_count: number
          p_org_id: string
          p_secret: string
        }
        Returns: string
      }
      store_whatsapp_integration: {
        Args: {
          p_actor_user_id: string
          p_base_url: string
          p_credential_hint: string
          p_external_account_id: string
          p_external_business_id: string
          p_external_phone_number_id: string
          p_label: string
          p_latency_ms: number
          p_metadata: Json
          p_operation_id: string
          p_org_id: string
          p_phone_e164: string
          p_provider: string
          p_secret: string
          p_visible_profile_name: string
        }
        Returns: string
      }
      submit_access_request: {
        Args: {
          p_approximate_brokers?: number
          p_city?: string
          p_cnpj?: string
          p_creci?: string
          p_introduction?: string
          p_join_code?: string
          p_operation_description?: string
          p_organization_name?: string
          p_request_type: string
          p_state?: string
          p_whatsapp_e164: string
        }
        Returns: string
      }
      support_access_context: {
        Args: { p_org_id: string }
        Returns: {
          access_level: string
          org_id: string
          organization_name: string
          organization_status: string
        }[]
      }
      update_member_whatsapp: {
        Args: { p_membership_id: string; p_whatsapp_e164: string }
        Returns: undefined
      }
      upsert_platform_push_subscription: {
        Args: {
          p_auth_key: string
          p_endpoint: string
          p_p256dh: string
          p_user_agent?: string
        }
        Returns: string
      }
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
