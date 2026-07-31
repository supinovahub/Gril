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
      attachments: {
        Row: {
          created_at: string
          id: string
          message_id: string
          mime_type: string | null
          org_id: string
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
      conversation_summaries: {
        Row: {
          conversation_id: string
          created_at: string
          facts: Json
          generated_by: string
          id: string
          message_cursor_id: string | null
          org_id: string
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
          channel: string
          closed_at: string | null
          connection_id: string
          contact_id: string
          created_at: string
          id: string
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
          channel?: string
          closed_at?: string | null
          connection_id: string
          contact_id: string
          created_at?: string
          id?: string
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
          channel?: string
          closed_at?: string | null
          connection_id?: string
          contact_id?: string
          created_at?: string
          id?: string
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
      escalations: {
        Row: {
          category: string
          claimed_at: string | null
          claimed_by: string | null
          conversation_id: string | null
          created_at: string
          id: string
          operation_id: string
          opportunity_id: string | null
          org_id: string
          reason: string
          resolved_at: string | null
          severity: string
          status: string
        }
        Insert: {
          category: string
          claimed_at?: string | null
          claimed_by?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          operation_id: string
          opportunity_id?: string | null
          org_id: string
          reason: string
          resolved_at?: string | null
          severity: string
          status?: string
        }
        Update: {
          category?: string
          claimed_at?: string | null
          claimed_by?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          operation_id?: string
          opportunity_id?: string | null
          org_id?: string
          reason?: string
          resolved_at?: string | null
          severity?: string
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
      message_send_requests: {
        Row: {
          actor_user_id: string
          body: string
          conversation_id: string
          created_at: string
          expected_conversation_version: number
          id: string
          message_id: string | null
          org_id: string
          processed_at: string
          reply_to_message_id: string | null
        }
        Insert: {
          actor_user_id?: string
          body: string
          conversation_id: string
          created_at?: string
          expected_conversation_version: number
          id?: string
          message_id?: string | null
          org_id: string
          processed_at?: string
          reply_to_message_id?: string | null
        }
        Update: {
          actor_user_id?: string
          body?: string
          conversation_id?: string
          created_at?: string
          expected_conversation_version?: number
          id?: string
          message_id?: string | null
          org_id?: string
          processed_at?: string
          reply_to_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_send_requests_conversation_id_org_id_fkey"
            columns: ["conversation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id", "org_id"]
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
          business_hours: Json
          created_at: string
          default_persona_id: string | null
          operation_id: string
          org_id: string
          proactive_openings_per_minute: number
          updated_at: string
        }
        Insert: {
          business_hours?: Json
          created_at?: string
          default_persona_id?: string | null
          operation_id: string
          org_id: string
          proactive_openings_per_minute?: number
          updated_at?: string
        }
        Update: {
          business_hours?: Json
          created_at?: string
          default_persona_id?: string | null
          operation_id?: string
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
            foreignKeyName: "opportunities_current_conversation_id_fkey"
            columns: ["current_conversation_id", "org_id"]
            isOneToOne: false
            referencedRelation: "conversations"
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
      organization_settings: {
        Row: {
          ai_global_mode: string
          ai_monthly_budget: number | null
          brand_settings: Json
          created_at: string
          institutional_profile: Json
          org_id: string
          updated_at: string
        }
        Insert: {
          ai_global_mode?: string
          ai_monthly_budget?: number | null
          brand_settings?: Json
          created_at?: string
          institutional_profile?: Json
          org_id: string
          updated_at?: string
        }
        Update: {
          ai_global_mode?: string
          ai_monthly_budget?: number | null
          brand_settings?: Json
          created_at?: string
          institutional_profile?: Json
          org_id?: string
          updated_at?: string
        }
        Relationships: [
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
          org_id: string
          project_id: string
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
          org_id: string
          project_id: string
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
          org_id?: string
          project_id?: string
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
          execution_id: string | null
          id: number
          input_tokens: number
          model_identifier: string
          operation_id: string | null
          org_id: string
          output_tokens: number
          recorded_at: string
          usage_type: string
        }
        Insert: {
          estimated_cost?: number
          execution_id?: string | null
          id?: never
          input_tokens?: number
          model_identifier: string
          operation_id?: string | null
          org_id: string
          output_tokens?: number
          recorded_at?: string
          usage_type: string
        }
        Update: {
          estimated_cost?: number
          execution_id?: string | null
          id?: never
          input_tokens?: number
          model_identifier?: string
          operation_id?: string | null
          org_id?: string
          output_tokens?: number
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
          last_error_redacted: string | null
          last_health_at: string | null
          name: string
          operation_id: string
          org_id: string
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
          last_error_redacted?: string | null
          last_health_at?: string | null
          name: string
          operation_id: string
          org_id: string
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
          last_error_redacted?: string | null
          last_health_at?: string | null
          name?: string
          operation_id?: string
          org_id?: string
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
