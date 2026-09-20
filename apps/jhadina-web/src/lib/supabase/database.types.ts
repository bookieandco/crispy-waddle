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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      acquisition_checkpoints: {
        Row: {
          artifact_sha256: string | null
          artifact_url: string | null
          checkpoint_hash: string
          created_at: string
          id: number
          idempotency_key: string
          jurisdiction_id: string
          previous_receipt_hash: string | null
          receipt_hash: string
          source_id: string
          state: string
          surplus_artifact_sha256: string | null
          surplus_artifact_url: string | null
        }
        Insert: {
          artifact_sha256?: string | null
          artifact_url?: string | null
          checkpoint_hash: string
          created_at?: string
          id?: never
          idempotency_key: string
          jurisdiction_id: string
          previous_receipt_hash?: string | null
          receipt_hash: string
          source_id: string
          state: string
          surplus_artifact_sha256?: string | null
          surplus_artifact_url?: string | null
        }
        Update: {
          artifact_sha256?: string | null
          artifact_url?: string | null
          checkpoint_hash?: string
          created_at?: string
          id?: never
          idempotency_key?: string
          jurisdiction_id?: string
          previous_receipt_hash?: string | null
          receipt_hash?: string
          source_id?: string
          state?: string
          surplus_artifact_sha256?: string | null
          surplus_artifact_url?: string | null
        }
        Relationships: []
      }
      acquisition_worker_attempts: {
        Row: {
          attempt: number
          attempt_hash: string
          checkpoint_hash: string | null
          created_at: string
          error_code: string | null
          fence_token: number
          id: number
          idempotency_key: string
          jurisdiction_id: string
          lease_token: string
          outcome: string
          previous_attempt_hash: string | null
          source_id: string
        }
        Insert: {
          attempt: number
          attempt_hash: string
          checkpoint_hash?: string | null
          created_at?: string
          error_code?: string | null
          fence_token: number
          id?: never
          idempotency_key: string
          jurisdiction_id: string
          lease_token: string
          outcome: string
          previous_attempt_hash?: string | null
          source_id: string
        }
        Update: {
          attempt?: number
          attempt_hash?: string
          checkpoint_hash?: string | null
          created_at?: string
          error_code?: string | null
          fence_token?: number
          id?: never
          idempotency_key?: string
          jurisdiction_id?: string
          lease_token?: string
          outcome?: string
          previous_attempt_hash?: string | null
          source_id?: string
        }
        Relationships: []
      }
      acquisition_worker_leases: {
        Row: {
          acquired_at: string
          expires_at: string
          fence_token: number
          holder_id: string
          idempotency_key: string
          jurisdiction_id: string
          lease_token: string
          source_id: string
        }
        Insert: {
          acquired_at?: string
          expires_at: string
          fence_token?: number
          holder_id: string
          idempotency_key: string
          jurisdiction_id: string
          lease_token: string
          source_id: string
        }
        Update: {
          acquired_at?: string
          expires_at?: string
          fence_token?: number
          holder_id?: string
          idempotency_key?: string
          jurisdiction_id?: string
          lease_token?: string
          source_id?: string
        }
        Relationships: []
      }
      competitive_evidence: {
        Row: {
          confidence: number | null
          created_at: string
          derived_from_evidence_ids: Json | null
          evidence_id: string
          kind: string
          model_id: string | null
          observed_at: string
          owner_id: string
          source: Json
          subject_id: string
          value: Json
        }
        Insert: {
          confidence?: number | null
          created_at: string
          derived_from_evidence_ids?: Json | null
          evidence_id: string
          kind: string
          model_id?: string | null
          observed_at: string
          owner_id: string
          source: Json
          subject_id: string
          value: Json
        }
        Update: {
          confidence?: number | null
          created_at?: string
          derived_from_evidence_ids?: Json | null
          evidence_id?: string
          kind?: string
          model_id?: string | null
          observed_at?: string
          owner_id?: string
          source?: Json
          subject_id?: string
          value?: Json
        }
        Relationships: []
      }
      corporate_intelligence_entities: {
        Row: {
          canonical_key: string
          created_at: string
          entity_number: string | null
          first_seen_at: string
          formed_at: string | null
          id: string
          jurisdiction: string | null
          last_seen_at: string
          legal_name: string
          metadata: Json
          source: string
          source_reference: string
          status: string | null
          updated_at: string
        }
        Insert: {
          canonical_key: string
          created_at?: string
          entity_number?: string | null
          first_seen_at?: string
          formed_at?: string | null
          id?: string
          jurisdiction?: string | null
          last_seen_at?: string
          legal_name: string
          metadata?: Json
          source: string
          source_reference: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          canonical_key?: string
          created_at?: string
          entity_number?: string | null
          first_seen_at?: string
          formed_at?: string | null
          id?: string
          jurisdiction?: string | null
          last_seen_at?: string
          legal_name?: string
          metadata?: Json
          source?: string
          source_reference?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      corporate_intelligence_evidence: {
        Row: {
          created_at: string
          entity_id: string
          evidence_type: string
          fingerprint: string
          id: string
          metadata: Json
          observed_at: string
          source: string
          source_reference: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          evidence_type?: string
          fingerprint: string
          id?: string
          metadata?: Json
          observed_at?: string
          source: string
          source_reference: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          evidence_type?: string
          fingerprint?: string
          id?: string
          metadata?: Json
          observed_at?: string
          source?: string
          source_reference?: string
        }
        Relationships: [
          {
            foreignKeyName: "corporate_intelligence_evidence_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "corporate_intelligence_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      corporate_intelligence_relationships: {
        Row: {
          confidence: number
          created_at: string
          evidence_ids: Json
          from_entity_id: string
          id: string
          metadata: Json
          observed_at: string
          relationship_type: string
          source: string
          source_reference: string
          to_entity_id: string
        }
        Insert: {
          confidence: number
          created_at?: string
          evidence_ids?: Json
          from_entity_id: string
          id?: string
          metadata?: Json
          observed_at?: string
          relationship_type: string
          source: string
          source_reference: string
          to_entity_id: string
        }
        Update: {
          confidence?: number
          created_at?: string
          evidence_ids?: Json
          from_entity_id?: string
          id?: string
          metadata?: Json
          observed_at?: string
          relationship_type?: string
          source?: string
          source_reference?: string
          to_entity_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "corporate_intelligence_relationships_from_entity_id_fkey"
            columns: ["from_entity_id"]
            isOneToOne: false
            referencedRelation: "corporate_intelligence_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corporate_intelligence_relationships_to_entity_id_fkey"
            columns: ["to_entity_id"]
            isOneToOne: false
            referencedRelation: "corporate_intelligence_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      director_editing_asset_approvals: {
        Row: {
          approval_id: string
          approved_at: string
          asset_id: string
        }
        Insert: {
          approval_id: string
          approved_at?: string
          asset_id: string
        }
        Update: {
          approval_id?: string
          approved_at?: string
          asset_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "director_editing_asset_approvals_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: true
            referencedRelation: "director_generated_editing_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      director_generated_editing_assets: {
        Row: {
          created_at: string
          generation_job_id: string
          id: string
          loras: Json | null
          media_type: string
          metadata: Json
          mime_type: string | null
          model_id: string | null
          project_id: string
          prompt: string | null
          provider_id: string
          sha256: string | null
          uri: string
          workflow_id: string | null
          workflow_version: number | null
        }
        Insert: {
          created_at?: string
          generation_job_id: string
          id: string
          loras?: Json | null
          media_type: string
          metadata?: Json
          mime_type?: string | null
          model_id?: string | null
          project_id: string
          prompt?: string | null
          provider_id: string
          sha256?: string | null
          uri: string
          workflow_id?: string | null
          workflow_version?: number | null
        }
        Update: {
          created_at?: string
          generation_job_id?: string
          id?: string
          loras?: Json | null
          media_type?: string
          metadata?: Json
          mime_type?: string | null
          model_id?: string | null
          project_id?: string
          prompt?: string | null
          provider_id?: string
          sha256?: string | null
          uri?: string
          workflow_id?: string | null
          workflow_version?: number | null
        }
        Relationships: []
      }
      director_generation_executions: {
        Row: {
          attempt: number
          created_at: string
          error: string | null
          id: string
          lease_expires_at: string | null
          lease_owner: string | null
          lease_token: string | null
          provider_id: string
          provider_job_id: string | null
          status: string
          task_id: string
          updated_at: string
        }
        Insert: {
          attempt: number
          created_at?: string
          error?: string | null
          id: string
          lease_expires_at?: string | null
          lease_owner?: string | null
          lease_token?: string | null
          provider_id: string
          provider_job_id?: string | null
          status: string
          task_id: string
          updated_at?: string
        }
        Update: {
          attempt?: number
          created_at?: string
          error?: string | null
          id?: string
          lease_expires_at?: string | null
          lease_owner?: string | null
          lease_token?: string | null
          provider_id?: string
          provider_job_id?: string | null
          status?: string
          task_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "director_generation_executions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "director_generation_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      director_generation_submission_outbox: {
        Row: {
          attempt: number
          created_at: string
          execution_id: string
          id: string
          idempotency_key: string
          last_error: string | null
          lease_expires_at: string | null
          lease_owner: string | null
          lease_token: string | null
          provider_id: string
          provider_job_id: string | null
          request_payload: Json
          status: string
          task_id: string
          updated_at: string
        }
        Insert: {
          attempt?: number
          created_at?: string
          execution_id: string
          id?: string
          idempotency_key: string
          last_error?: string | null
          lease_expires_at?: string | null
          lease_owner?: string | null
          lease_token?: string | null
          provider_id: string
          provider_job_id?: string | null
          request_payload: Json
          status?: string
          task_id: string
          updated_at?: string
        }
        Update: {
          attempt?: number
          created_at?: string
          execution_id?: string
          id?: string
          idempotency_key?: string
          last_error?: string | null
          lease_expires_at?: string | null
          lease_owner?: string | null
          lease_token?: string | null
          provider_id?: string
          provider_job_id?: string | null
          request_payload?: Json
          status?: string
          task_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      director_generation_tasks: {
        Row: {
          created_at: string
          edit_plan_id: string | null
          error: string | null
          id: string
          idempotency_key: string
          operation_id: string | null
          project_id: string
          request: Json
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          edit_plan_id?: string | null
          error?: string | null
          id: string
          idempotency_key: string
          operation_id?: string | null
          project_id: string
          request: Json
          status: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          edit_plan_id?: string | null
          error?: string | null
          id?: string
          idempotency_key?: string
          operation_id?: string | null
          project_id?: string
          request?: Json
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      jhadina_actor_outcome_history: {
        Row: {
          actor_id: string
          actor_key: string
          actor_kind: string
          association_confidence: number
          bad_launches: number
          confidence: number
          created_at: string
          evaluated_at: string
          evaluator_version: string
          evidence_ids: string[]
          failed_launches: number
          healthy_launches: number
          launches: number
          outcome_coverage: number
          pump_and_dump_rate: number
          rug_rate: number
          updated_at: string
        }
        Insert: {
          actor_id: string
          actor_key: string
          actor_kind: string
          association_confidence?: number
          bad_launches?: number
          confidence?: number
          created_at?: string
          evaluated_at: string
          evaluator_version: string
          evidence_ids?: string[]
          failed_launches?: number
          healthy_launches?: number
          launches?: number
          outcome_coverage?: number
          pump_and_dump_rate?: number
          rug_rate?: number
          updated_at?: string
        }
        Update: {
          actor_id?: string
          actor_key?: string
          actor_kind?: string
          association_confidence?: number
          bad_launches?: number
          confidence?: number
          created_at?: string
          evaluated_at?: string
          evaluator_version?: string
          evidence_ids?: string[]
          failed_launches?: number
          healthy_launches?: number
          launches?: number
          outcome_coverage?: number
          pump_and_dump_rate?: number
          rug_rate?: number
          updated_at?: string
        }
        Relationships: []
      }
      jhadina_agent_checkpoints: {
        Row: {
          created_at: string
          id: string
          plan_id: string | null
          plan_revision: number
          reason: string
          run_id: string
          state: Json
          step_id: string | null
        }
        Insert: {
          created_at: string
          id: string
          plan_id?: string | null
          plan_revision?: number
          reason: string
          run_id: string
          state: Json
          step_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          plan_id?: string | null
          plan_revision?: number
          reason?: string
          run_id?: string
          state?: Json
          step_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jhadina_agent_checkpoints_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "jhadina_agent_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      jhadina_agent_plans: {
        Row: {
          created_at: string
          id: string
          objective: string
          rationale: string
          revision: number
          run_id: string
          steps: Json
          supersedes_plan_id: string | null
        }
        Insert: {
          created_at: string
          id: string
          objective: string
          rationale: string
          revision: number
          run_id: string
          steps: Json
          supersedes_plan_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          objective?: string
          rationale?: string
          revision?: number
          run_id?: string
          steps?: Json
          supersedes_plan_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jhadina_agent_plans_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "jhadina_agent_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jhadina_agent_plans_supersedes_plan_id_fkey"
            columns: ["supersedes_plan_id"]
            isOneToOne: false
            referencedRelation: "jhadina_agent_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      jhadina_agent_policy_decisions: {
        Row: {
          allowed: boolean
          evaluated_at: string
          id: string
          reason: string
          required_approval: boolean
          run_id: string
          step_id: string | null
        }
        Insert: {
          allowed: boolean
          evaluated_at: string
          id: string
          reason: string
          required_approval: boolean
          run_id: string
          step_id?: string | null
        }
        Update: {
          allowed?: boolean
          evaluated_at?: string
          id?: string
          reason?: string
          required_approval?: boolean
          run_id?: string
          step_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jhadina_agent_policy_decisions_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "jhadina_agent_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      jhadina_agent_runs: {
        Row: {
          created_at: string
          current_step_id: string | null
          id: string
          objective: string
          plan_revision: number
          policy_decision_id: string | null
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at: string
          current_step_id?: string | null
          id: string
          objective: string
          plan_revision?: number
          policy_decision_id?: string | null
          status: string
          updated_at: string
          version?: number
        }
        Update: {
          created_at?: string
          current_step_id?: string | null
          id?: string
          objective?: string
          plan_revision?: number
          policy_decision_id?: string | null
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      jhadina_agent_steps: {
        Row: {
          attempt: number
          capability: string | null
          completed_at: string | null
          error: string | null
          id: string
          input: Json | null
          kind: string
          operation: string | null
          ordinal: number
          output: Json | null
          plan_id: string
          plan_revision: number
          policy_decision_id: string | null
          run_id: string
          started_at: string | null
          status: string
        }
        Insert: {
          attempt?: number
          capability?: string | null
          completed_at?: string | null
          error?: string | null
          id: string
          input?: Json | null
          kind: string
          operation?: string | null
          ordinal: number
          output?: Json | null
          plan_id: string
          plan_revision: number
          policy_decision_id?: string | null
          run_id: string
          started_at?: string | null
          status: string
        }
        Update: {
          attempt?: number
          capability?: string | null
          completed_at?: string | null
          error?: string | null
          id?: string
          input?: Json | null
          kind?: string
          operation?: string | null
          ordinal?: number
          output?: Json | null
          plan_id?: string
          plan_revision?: number
          policy_decision_id?: string | null
          run_id?: string
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "jhadina_agent_steps_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "jhadina_agent_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jhadina_agent_steps_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "jhadina_agent_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      jhadina_audit_ledger: {
        Row: {
          actor_id: string
          capability: string
          created_at: string
          decision: string
          domain: string
          event_hash: string
          event_id: string
          id: string
          metadata: Json
          occurred_at: string
          previous_hash: string
          request_id: string
          status: string
        }
        Insert: {
          actor_id: string
          capability: string
          created_at?: string
          decision: string
          domain: string
          event_hash: string
          event_id: string
          id?: string
          metadata?: Json
          occurred_at?: string
          previous_hash: string
          request_id: string
          status?: string
        }
        Update: {
          actor_id?: string
          capability?: string
          created_at?: string
          decision?: string
          domain?: string
          event_hash?: string
          event_id?: string
          id?: string
          metadata?: Json
          occurred_at?: string
          previous_hash?: string
          request_id?: string
          status?: string
        }
        Relationships: []
      }
      jhadina_audit_ledger_head: {
        Row: {
          event_count: number
          head_hash: string
          id: boolean
          updated_at: string
        }
        Insert: {
          event_count?: number
          head_hash?: string
          id?: boolean
          updated_at?: string
        }
        Update: {
          event_count?: number
          head_hash?: string
          id?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      jhadina_audit_runs: {
        Row: {
          audit_hash: string | null
          completed_at: string | null
          created_at: string
          error: string | null
          id: string
          run_key: string
          scheduled_for: string
          started_at: string | null
          status: string
          summary: Json
          updated_at: string
        }
        Insert: {
          audit_hash?: string | null
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          run_key: string
          scheduled_for: string
          started_at?: string | null
          status?: string
          summary?: Json
          updated_at?: string
        }
        Update: {
          audit_hash?: string | null
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          run_key?: string
          scheduled_for?: string
          started_at?: string | null
          status?: string
          summary?: Json
          updated_at?: string
        }
        Relationships: []
      }
      jhadina_capital_lot_projection: {
        Row: {
          acquired_at: string
          created_at: string
          currency: string
          id: string
          position_id: string
          projection_version: number
          quantity: number
          remaining_quantity: number
          source_transaction_id: string
          unit_cost: number
        }
        Insert: {
          acquired_at: string
          created_at?: string
          currency: string
          id?: string
          position_id: string
          projection_version?: number
          quantity: number
          remaining_quantity: number
          source_transaction_id: string
          unit_cost: number
        }
        Update: {
          acquired_at?: string
          created_at?: string
          currency?: string
          id?: string
          position_id?: string
          projection_version?: number
          quantity?: number
          remaining_quantity?: number
          source_transaction_id?: string
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "jhadina_capital_lot_projection_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "jhadina_capital_position_projection"
            referencedColumns: ["id"]
          },
        ]
      }
      jhadina_capital_position_projection: {
        Row: {
          account_id: string
          average_cost: number
          currency: string
          domain: string
          id: string
          instrument: string
          projection_version: number
          quantity: number
          realized_pnl: number
          updated_at: string
        }
        Insert: {
          account_id: string
          average_cost?: number
          currency: string
          domain: string
          id?: string
          instrument: string
          projection_version?: number
          quantity?: number
          realized_pnl?: number
          updated_at?: string
        }
        Update: {
          account_id?: string
          average_cost?: number
          currency?: string
          domain?: string
          id?: string
          instrument?: string
          projection_version?: number
          quantity?: number
          realized_pnl?: number
          updated_at?: string
        }
        Relationships: []
      }
      jhadina_capital_transaction_projection: {
        Row: {
          account_id: string
          classification_status: string
          created_at: string
          currency: string
          domain: string
          id: string
          instrument: string
          occurred_at: string
          projection_version: number
          quantity: number
          replayed_at: string | null
          side: string
          source_transaction_id: string
          unit_price: number
          updated_at: string
        }
        Insert: {
          account_id: string
          classification_status?: string
          created_at?: string
          currency: string
          domain: string
          id?: string
          instrument: string
          occurred_at: string
          projection_version?: number
          quantity: number
          replayed_at?: string | null
          side: string
          source_transaction_id: string
          unit_price: number
          updated_at?: string
        }
        Update: {
          account_id?: string
          classification_status?: string
          created_at?: string
          currency?: string
          domain?: string
          id?: string
          instrument?: string
          occurred_at?: string
          projection_version?: number
          quantity?: number
          replayed_at?: string | null
          side?: string
          source_transaction_id?: string
          unit_price?: number
          updated_at?: string
        }
        Relationships: []
      }
      jhadina_connector_execution_ledger: {
        Row: {
          actor_id: string | null
          approval_id: string | null
          completed_at: string | null
          connector_id: string | null
          correlation_id: string | null
          error: string | null
          execution_id: string
          idempotency_key: string | null
          operation: string | null
          proposal_hash: string
          proposal_id: string | null
          recovery_lease_expires_at: string | null
          recovery_lease_id: string | null
          recovery_of_execution_id: string | null
          response: Json | null
          started_at: string
          state: string
          updated_at: string
        }
        Insert: {
          actor_id?: string | null
          approval_id?: string | null
          completed_at?: string | null
          connector_id?: string | null
          correlation_id?: string | null
          error?: string | null
          execution_id?: string
          idempotency_key?: string | null
          operation?: string | null
          proposal_hash: string
          proposal_id?: string | null
          recovery_lease_expires_at?: string | null
          recovery_lease_id?: string | null
          recovery_of_execution_id?: string | null
          response?: Json | null
          started_at?: string
          state: string
          updated_at?: string
        }
        Update: {
          actor_id?: string | null
          approval_id?: string | null
          completed_at?: string | null
          connector_id?: string | null
          correlation_id?: string | null
          error?: string | null
          execution_id?: string
          idempotency_key?: string | null
          operation?: string | null
          proposal_hash?: string
          proposal_id?: string | null
          recovery_lease_expires_at?: string | null
          recovery_lease_id?: string | null
          recovery_of_execution_id?: string | null
          response?: Json | null
          started_at?: string
          state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jhadina_connector_execution_ledge_recovery_of_execution_id_fkey"
            columns: ["recovery_of_execution_id"]
            isOneToOne: false
            referencedRelation: "jhadina_connector_execution_ledger"
            referencedColumns: ["execution_id"]
          },
        ]
      }
      jhadina_connector_execution_reconciliation: {
        Row: {
          adapter_id: string
          adapter_version: number
          checked_at: string
          created_at: string
          evidence: Json
          evidence_hash: string
          execution_id: string
          observed_state: string | null
          proposal_hash: string
          provider_operation: string | null
          provider_reference: string | null
          reconciliation_id: string
          status: string
        }
        Insert: {
          adapter_id: string
          adapter_version: number
          checked_at?: string
          created_at?: string
          evidence?: Json
          evidence_hash: string
          execution_id: string
          observed_state?: string | null
          proposal_hash: string
          provider_operation?: string | null
          provider_reference?: string | null
          reconciliation_id?: string
          status: string
        }
        Update: {
          adapter_id?: string
          adapter_version?: number
          checked_at?: string
          created_at?: string
          evidence?: Json
          evidence_hash?: string
          execution_id?: string
          observed_state?: string | null
          proposal_hash?: string
          provider_operation?: string | null
          provider_reference?: string | null
          reconciliation_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "jhadina_connector_execution_reconciliation_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "jhadina_connector_execution_ledger"
            referencedColumns: ["execution_id"]
          },
        ]
      }
      jhadina_evolution_candidates: {
        Row: {
          affected_paths: Json
          audit_run_id: string
          candidate_id: string
          category: string
          change_size: number
          confidence: number
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_reason: string | null
          discovered_at: string
          evidence_refs: Json
          execution_id: string | null
          id: string
          impact: number
          priority: number
          problem: string
          proposal_hash: string
          recurrence: number
          risk: string
          status: string
          suggested_change: string
          title: string
          updated_at: string
          verification_plan: Json
        }
        Insert: {
          affected_paths?: Json
          audit_run_id: string
          candidate_id: string
          category: string
          change_size: number
          confidence: number
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_reason?: string | null
          discovered_at: string
          evidence_refs?: Json
          execution_id?: string | null
          id?: string
          impact: number
          priority: number
          problem: string
          proposal_hash: string
          recurrence: number
          risk: string
          status?: string
          suggested_change: string
          title: string
          updated_at?: string
          verification_plan?: Json
        }
        Update: {
          affected_paths?: Json
          audit_run_id?: string
          candidate_id?: string
          category?: string
          change_size?: number
          confidence?: number
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_reason?: string | null
          discovered_at?: string
          evidence_refs?: Json
          execution_id?: string | null
          id?: string
          impact?: number
          priority?: number
          problem?: string
          proposal_hash?: string
          recurrence?: number
          risk?: string
          status?: string
          suggested_change?: string
          title?: string
          updated_at?: string
          verification_plan?: Json
        }
        Relationships: []
      }
      jhadina_evolution_run_ledger: {
        Row: {
          created_at: string
          event_id: string
          hash: string
          id: string
          occurred_at: string
          payload: Json
          previous_hash: string | null
          run_id: number
          sequence: number
          task_id: string
          type: string
        }
        Insert: {
          created_at?: string
          event_id: string
          hash: string
          id?: string
          occurred_at: string
          payload?: Json
          previous_hash?: string | null
          run_id: number
          sequence: number
          task_id: string
          type: string
        }
        Update: {
          created_at?: string
          event_id?: string
          hash?: string
          id?: string
          occurred_at?: string
          payload?: Json
          previous_hash?: string | null
          run_id?: number
          sequence?: number
          task_id?: string
          type?: string
        }
        Relationships: []
      }
      jhadina_evolution_run_ledger_head: {
        Row: {
          event_hash: string | null
          sequence: number
          singleton: boolean
          updated_at: string
        }
        Insert: {
          event_hash?: string | null
          sequence?: number
          singleton?: boolean
          updated_at?: string
        }
        Update: {
          event_hash?: string | null
          sequence?: number
          singleton?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      jhadina_execution_receipts: {
        Row: {
          action_id: string
          actor_id: string
          approval_state: string
          approved_at: string | null
          authorization_context: Json
          capability: string
          created_at: string
          executed_at: string | null
          execution_state: string
          receipt_id: string
          request_id: string
          result_metadata: Json
          updated_at: string
        }
        Insert: {
          action_id: string
          actor_id: string
          approval_state: string
          approved_at?: string | null
          authorization_context?: Json
          capability: string
          created_at?: string
          executed_at?: string | null
          execution_state?: string
          receipt_id?: string
          request_id: string
          result_metadata?: Json
          updated_at?: string
        }
        Update: {
          action_id?: string
          actor_id?: string
          approval_state?: string
          approved_at?: string | null
          authorization_context?: Json
          capability?: string
          created_at?: string
          executed_at?: string | null
          execution_state?: string
          receipt_id?: string
          request_id?: string
          result_metadata?: Json
          updated_at?: string
        }
        Relationships: []
      }
      jhadina_experience_events: {
        Row: {
          actor: string
          causation_id: string | null
          content: string
          correlation_id: string | null
          created_at: string
          domain: string | null
          event_id: string
          event_type: string
          evidence: Json
          id: string
          metadata: Json | null
          occurred_at: string
          outcome: string | null
          provenance: Json
          recorded_at: string
          sensitivity: string
          source: string
          user_id: string
        }
        Insert: {
          actor: string
          causation_id?: string | null
          content: string
          correlation_id?: string | null
          created_at?: string
          domain?: string | null
          event_id: string
          event_type: string
          evidence?: Json
          id?: string
          metadata?: Json | null
          occurred_at: string
          outcome?: string | null
          provenance?: Json
          recorded_at?: string
          sensitivity?: string
          source: string
          user_id: string
        }
        Update: {
          actor?: string
          causation_id?: string | null
          content?: string
          correlation_id?: string | null
          created_at?: string
          domain?: string | null
          event_id?: string
          event_type?: string
          evidence?: Json
          id?: string
          metadata?: Json | null
          occurred_at?: string
          outcome?: string | null
          provenance?: Json
          recorded_at?: string
          sensitivity?: string
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      jhadina_knowledge_candidate_evidence: {
        Row: {
          candidate_id: string
          created_at: string
          evidence_id: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          evidence_id: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          evidence_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jhadina_knowledge_candidate_evidence_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "jhadina_knowledge_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jhadina_knowledge_candidate_evidence_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "jhadina_knowledge_evidence"
            referencedColumns: ["id"]
          },
        ]
      }
      jhadina_knowledge_candidates: {
        Row: {
          admitted_knowledge_record_id: string | null
          claim: string
          confidence: number
          content_hash: string
          contradiction_state: string
          created_at: string
          evaluation: Json
          execution_event_id: string
          id: string
          minimum_authority_score: number
          minimum_sources: number
          object_json: Json
          observed_at: string
          plan_id: string
          predicate: string
          require_fresh: boolean
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          admitted_knowledge_record_id?: string | null
          claim: string
          confidence: number
          content_hash: string
          contradiction_state?: string
          created_at?: string
          evaluation?: Json
          execution_event_id: string
          id?: string
          minimum_authority_score?: number
          minimum_sources?: number
          object_json?: Json
          observed_at?: string
          plan_id: string
          predicate?: string
          require_fresh?: boolean
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          admitted_knowledge_record_id?: string | null
          claim?: string
          confidence?: number
          content_hash?: string
          contradiction_state?: string
          created_at?: string
          evaluation?: Json
          execution_event_id?: string
          id?: string
          minimum_authority_score?: number
          minimum_sources?: number
          object_json?: Json
          observed_at?: string
          plan_id?: string
          predicate?: string
          require_fresh?: boolean
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jhadina_knowledge_candidates_admitted_knowledge_record_id_fkey"
            columns: ["admitted_knowledge_record_id"]
            isOneToOne: false
            referencedRelation: "jhadina_knowledge_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jhadina_knowledge_candidates_execution_event_id_fkey"
            columns: ["execution_event_id"]
            isOneToOne: false
            referencedRelation: "jhadina_research_execution_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jhadina_knowledge_candidates_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "jhadina_research_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      jhadina_knowledge_evidence: {
        Row: {
          authority_score: number
          captured_at: string
          content_changed: boolean
          content_hash: string | null
          created_at: string
          document_id: string | null
          excerpt: string | null
          freshness_sla_hours: number | null
          freshness_state: string
          id: string
          knowledge_record_id: string | null
          last_verified_at: string | null
          locator: Json
          metadata: Json
          source_id: string
          updated_at: string
          verification_state: string
        }
        Insert: {
          authority_score?: number
          captured_at?: string
          content_changed?: boolean
          content_hash?: string | null
          created_at?: string
          document_id?: string | null
          excerpt?: string | null
          freshness_sla_hours?: number | null
          freshness_state?: string
          id?: string
          knowledge_record_id?: string | null
          last_verified_at?: string | null
          locator?: Json
          metadata?: Json
          source_id: string
          updated_at?: string
          verification_state?: string
        }
        Update: {
          authority_score?: number
          captured_at?: string
          content_changed?: boolean
          content_hash?: string | null
          created_at?: string
          document_id?: string | null
          excerpt?: string | null
          freshness_sla_hours?: number | null
          freshness_state?: string
          id?: string
          knowledge_record_id?: string | null
          last_verified_at?: string | null
          locator?: Json
          metadata?: Json
          source_id?: string
          updated_at?: string
          verification_state?: string
        }
        Relationships: [
          {
            foreignKeyName: "jhadina_knowledge_evidence_knowledge_record_id_fkey"
            columns: ["knowledge_record_id"]
            isOneToOne: false
            referencedRelation: "jhadina_knowledge_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jhadina_knowledge_evidence_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "jhadina_knowledge_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      jhadina_knowledge_nodes: {
        Row: {
          attributes: Json
          created_at: string
          label: string
          node_id: string
          node_type: string
          provenance_refs: Json
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          attributes?: Json
          created_at?: string
          label: string
          node_id: string
          node_type: string
          provenance_refs?: Json
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          attributes?: Json
          created_at?: string
          label?: string
          node_id?: string
          node_type?: string
          provenance_refs?: Json
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: []
      }
      jhadina_knowledge_record_evidence: {
        Row: {
          created_at: string
          evidence_id: string
          knowledge_record_id: string
        }
        Insert: {
          created_at?: string
          evidence_id: string
          knowledge_record_id: string
        }
        Update: {
          created_at?: string
          evidence_id?: string
          knowledge_record_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jhadina_knowledge_record_evidence_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "jhadina_knowledge_evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jhadina_knowledge_record_evidence_knowledge_record_id_fkey"
            columns: ["knowledge_record_id"]
            isOneToOne: false
            referencedRelation: "jhadina_knowledge_records"
            referencedColumns: ["id"]
          },
        ]
      }
      jhadina_knowledge_records: {
        Row: {
          authority_score: number
          claim: string
          confidence: number
          content_changed: boolean
          content_hash: string | null
          created_at: string
          evidence: Json
          freshness_score: number
          freshness_sla_hours: number | null
          freshness_state: string
          id: string
          invalidation_reason: string | null
          knowledge_type: string
          last_checked_at: string | null
          last_verified_at: string | null
          object_json: Json
          observed_at: string
          owner_id: string | null
          predicate: string
          scope: string
          status: string
          subject: string
          superseded_by: string | null
          updated_at: string
          valid_from: string | null
          valid_until: string | null
          verification_state: string
          version: number
        }
        Insert: {
          authority_score?: number
          claim: string
          confidence: number
          content_changed?: boolean
          content_hash?: string | null
          created_at?: string
          evidence?: Json
          freshness_score?: number
          freshness_sla_hours?: number | null
          freshness_state?: string
          id?: string
          invalidation_reason?: string | null
          knowledge_type?: string
          last_checked_at?: string | null
          last_verified_at?: string | null
          object_json?: Json
          observed_at: string
          owner_id?: string | null
          predicate?: string
          scope?: string
          status?: string
          subject: string
          superseded_by?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
          verification_state?: string
          version?: number
        }
        Update: {
          authority_score?: number
          claim?: string
          confidence?: number
          content_changed?: boolean
          content_hash?: string | null
          created_at?: string
          evidence?: Json
          freshness_score?: number
          freshness_sla_hours?: number | null
          freshness_state?: string
          id?: string
          invalidation_reason?: string | null
          knowledge_type?: string
          last_checked_at?: string | null
          last_verified_at?: string | null
          object_json?: Json
          observed_at?: string
          owner_id?: string | null
          predicate?: string
          scope?: string
          status?: string
          subject?: string
          superseded_by?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
          verification_state?: string
          version?: number
        }
        Relationships: []
      }
      jhadina_knowledge_relations: {
        Row: {
          attributes: Json
          created_at: string
          from_node_id: string
          provenance_refs: Json
          relation_id: string
          relation_type: string
          to_node_id: string
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          attributes?: Json
          created_at?: string
          from_node_id: string
          provenance_refs?: Json
          relation_id: string
          relation_type: string
          to_node_id: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          attributes?: Json
          created_at?: string
          from_node_id?: string
          provenance_refs?: Json
          relation_id?: string
          relation_type?: string
          to_node_id?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jhadina_knowledge_relations_from_node_id_fkey"
            columns: ["from_node_id"]
            isOneToOne: false
            referencedRelation: "jhadina_knowledge_nodes"
            referencedColumns: ["node_id"]
          },
          {
            foreignKeyName: "jhadina_knowledge_relations_to_node_id_fkey"
            columns: ["to_node_id"]
            isOneToOne: false
            referencedRelation: "jhadina_knowledge_nodes"
            referencedColumns: ["node_id"]
          },
        ]
      }
      jhadina_knowledge_sources: {
        Row: {
          authority: string
          content_hash: string | null
          created_at: string
          external_source_key: string | null
          first_seen_at: string
          freshness_sla_hours: number | null
          id: string
          kind: string
          last_seen_at: string
          last_verified_at: string | null
          metadata: Json
          publisher: string | null
          trust_score: number
          updated_at: string
          uri: string
        }
        Insert: {
          authority?: string
          content_hash?: string | null
          created_at?: string
          external_source_key?: string | null
          first_seen_at?: string
          freshness_sla_hours?: number | null
          id?: string
          kind: string
          last_seen_at?: string
          last_verified_at?: string | null
          metadata?: Json
          publisher?: string | null
          trust_score?: number
          updated_at?: string
          uri: string
        }
        Update: {
          authority?: string
          content_hash?: string | null
          created_at?: string
          external_source_key?: string | null
          first_seen_at?: string
          freshness_sla_hours?: number | null
          id?: string
          kind?: string
          last_seen_at?: string
          last_verified_at?: string | null
          metadata?: Json
          publisher?: string | null
          trust_score?: number
          updated_at?: string
          uri?: string
        }
        Relationships: []
      }
      jhadina_launch_outcome_evaluations: {
        Row: {
          confidence: number
          created_at: string
          evaluated_at: string
          evaluated_outcome: string
          evaluation_id: string
          evaluator_version: string
          evidence_ids: string[]
          launch_id: string
          previous_outcome: string
          reasons: string[]
        }
        Insert: {
          confidence: number
          created_at?: string
          evaluated_at: string
          evaluated_outcome: string
          evaluation_id: string
          evaluator_version: string
          evidence_ids?: string[]
          launch_id: string
          previous_outcome: string
          reasons?: string[]
        }
        Update: {
          confidence?: number
          created_at?: string
          evaluated_at?: string
          evaluated_outcome?: string
          evaluation_id?: string
          evaluator_version?: string
          evidence_ids?: string[]
          launch_id?: string
          previous_outcome?: string
          reasons?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "jhadina_launch_outcome_evaluations_launch_id_fkey"
            columns: ["launch_id"]
            isOneToOne: false
            referencedRelation: "jhadina_token_launches"
            referencedColumns: ["launch_id"]
          },
        ]
      }
      jhadina_launch_outcome_observations: {
        Row: {
          created_at: string
          current_liquidity_usd: number | null
          developer_sold_pct: number | null
          evidence_ids: string[]
          holder_behavior: string | null
          holder_count_change_pct: number | null
          holder_exit_pct: number | null
          initial_liquidity_usd: number | null
          launch_id: string
          liquidity_drain_acceleration: number | null
          liquidity_drain_rate: number | null
          liquidity_drawdown_from_peak: number | null
          liquidity_removed: boolean | null
          liquidity_stability_score: number | null
          max_drawdown_pct: number | null
          observation_id: string
          observed_at: string
          peak_liquidity_usd: number | null
          peak_return_pct: number | null
          price_return_from_launch_pct: number | null
          source: string
          trading_halted: boolean | null
        }
        Insert: {
          created_at?: string
          current_liquidity_usd?: number | null
          developer_sold_pct?: number | null
          evidence_ids?: string[]
          holder_behavior?: string | null
          holder_count_change_pct?: number | null
          holder_exit_pct?: number | null
          initial_liquidity_usd?: number | null
          launch_id: string
          liquidity_drain_acceleration?: number | null
          liquidity_drain_rate?: number | null
          liquidity_drawdown_from_peak?: number | null
          liquidity_removed?: boolean | null
          liquidity_stability_score?: number | null
          max_drawdown_pct?: number | null
          observation_id: string
          observed_at: string
          peak_liquidity_usd?: number | null
          peak_return_pct?: number | null
          price_return_from_launch_pct?: number | null
          source: string
          trading_halted?: boolean | null
        }
        Update: {
          created_at?: string
          current_liquidity_usd?: number | null
          developer_sold_pct?: number | null
          evidence_ids?: string[]
          holder_behavior?: string | null
          holder_count_change_pct?: number | null
          holder_exit_pct?: number | null
          initial_liquidity_usd?: number | null
          launch_id?: string
          liquidity_drain_acceleration?: number | null
          liquidity_drain_rate?: number | null
          liquidity_drawdown_from_peak?: number | null
          liquidity_removed?: boolean | null
          liquidity_stability_score?: number | null
          max_drawdown_pct?: number | null
          observation_id?: string
          observed_at?: string
          peak_liquidity_usd?: number | null
          peak_return_pct?: number | null
          price_return_from_launch_pct?: number | null
          source?: string
          trading_halted?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "jhadina_launch_outcome_observations_launch_id_fkey"
            columns: ["launch_id"]
            isOneToOne: false
            referencedRelation: "jhadina_token_launches"
            referencedColumns: ["launch_id"]
          },
        ]
      }
      jhadina_learning_records: {
        Row: {
          action_request_id: string | null
          action_result_id: string | null
          actor: string
          correlation_id: string
          created_at: string
          domain: string
          evidence: Json
          experience_id: string | null
          id: string
          learning_update: Json
          occurred_at: string
          outcome: Json
          policy_decision_id: string | null
          prediction: Json | null
          proposal_id: string
          provenance: Json
          schema_version: string
          source: string
        }
        Insert: {
          action_request_id?: string | null
          action_result_id?: string | null
          actor: string
          correlation_id: string
          created_at?: string
          domain: string
          evidence?: Json
          experience_id?: string | null
          id: string
          learning_update: Json
          occurred_at: string
          outcome: Json
          policy_decision_id?: string | null
          prediction?: Json | null
          proposal_id: string
          provenance: Json
          schema_version: string
          source: string
        }
        Update: {
          action_request_id?: string | null
          action_result_id?: string | null
          actor?: string
          correlation_id?: string
          created_at?: string
          domain?: string
          evidence?: Json
          experience_id?: string | null
          id?: string
          learning_update?: Json
          occurred_at?: string
          outcome?: Json
          policy_decision_id?: string | null
          prediction?: Json | null
          proposal_id?: string
          provenance?: Json
          schema_version?: string
          source?: string
        }
        Relationships: []
      }
      jhadina_memories: {
        Row: {
          approved_at: string | null
          confidence: number
          content: string
          created_at: string
          id: string
          rejected_at: string | null
          status: string
          type: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          confidence: number
          content: string
          created_at: string
          id: string
          rejected_at?: string | null
          status: string
          type: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          confidence?: number
          content?: string
          created_at?: string
          id?: string
          rejected_at?: string | null
          status?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      jhadina_memory_candidates: {
        Row: {
          confidence: number
          content: string
          created_at: string
          id: string
          reasoning_event_id: string
          status: string
          type: string
          user_id: string
        }
        Insert: {
          confidence: number
          content: string
          created_at?: string
          id: string
          reasoning_event_id: string
          status?: string
          type: string
          user_id: string
        }
        Update: {
          confidence?: number
          content?: string
          created_at?: string
          id?: string
          reasoning_event_id?: string
          status?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      jhadina_mining_decisions: {
        Row: {
          confidence: number
          created_at: string
          decision: string
          decision_id: string
          health: string
          observed_at: string
          policy_version: string
          projected_electricity_per_hour: number | null
          projected_gross_per_hour: number | null
          projected_net_per_hour: number | null
          reasons: Json
          resource_id: string
        }
        Insert: {
          confidence: number
          created_at?: string
          decision: string
          decision_id: string
          health: string
          observed_at: string
          policy_version: string
          projected_electricity_per_hour?: number | null
          projected_gross_per_hour?: number | null
          projected_net_per_hour?: number | null
          reasons?: Json
          resource_id: string
        }
        Update: {
          confidence?: number
          created_at?: string
          decision?: string
          decision_id?: string
          health?: string
          observed_at?: string
          policy_version?: string
          projected_electricity_per_hour?: number | null
          projected_gross_per_hour?: number | null
          projected_net_per_hour?: number | null
          reasons?: Json
          resource_id?: string
        }
        Relationships: []
      }
      jhadina_mining_financial_events: {
        Row: {
          amount: number
          cost_basis: string | null
          created_at: string
          currency: string
          event_id: string
          event_type: string
          idempotency_key: string
          lifecycle: string
          metadata: Json
          observed_at: string
          resource_id: string
          source: string
          transaction_id: string | null
          verification_status: string
        }
        Insert: {
          amount: number
          cost_basis?: string | null
          created_at?: string
          currency: string
          event_id?: string
          event_type: string
          idempotency_key: string
          lifecycle: string
          metadata?: Json
          observed_at: string
          resource_id: string
          source: string
          transaction_id?: string | null
          verification_status: string
        }
        Update: {
          amount?: number
          cost_basis?: string | null
          created_at?: string
          currency?: string
          event_id?: string
          event_type?: string
          idempotency_key?: string
          lifecycle?: string
          metadata?: Json
          observed_at?: string
          resource_id?: string
          source?: string
          transaction_id?: string | null
          verification_status?: string
        }
        Relationships: []
      }
      jhadina_mining_processed_payouts: {
        Row: {
          block_hash: string
          block_height: number
          id: string
          network: string
          output_index: number
          payout_sats: number
          processed_at: string
          receiving_address: string
          txid: string
        }
        Insert: {
          block_hash: string
          block_height: number
          id?: string
          network: string
          output_index: number
          payout_sats: number
          processed_at?: string
          receiving_address: string
          txid: string
        }
        Update: {
          block_hash?: string
          block_height?: number
          id?: string
          network?: string
          output_index?: number
          payout_sats?: number
          processed_at?: string
          receiving_address?: string
          txid?: string
        }
        Relationships: []
      }
      jhadina_mining_scan_checkpoints: {
        Row: {
          checkpoint_id: string
          created_at: string
          last_scanned_hash: string
          last_scanned_height: number
          last_successful_scan_at: string
          network: string
          receiving_address: string
          reorg_lookback: number
          scanner_version: string
          updated_at: string
        }
        Insert: {
          checkpoint_id?: string
          created_at?: string
          last_scanned_hash: string
          last_scanned_height: number
          last_successful_scan_at: string
          network: string
          receiving_address: string
          reorg_lookback?: number
          scanner_version: string
          updated_at?: string
        }
        Update: {
          checkpoint_id?: string
          created_at?: string
          last_scanned_hash?: string
          last_scanned_height?: number
          last_successful_scan_at?: string
          network?: string
          receiving_address?: string
          reorg_lookback?: number
          scanner_version?: string
          updated_at?: string
        }
        Relationships: []
      }
      jhadina_opportunities: {
        Row: {
          approved_at: string | null
          created_at: string
          deadline: string | null
          family: string
          fit_score: number | null
          id: string
          opportunity_type: string
          payload: Json
          research_case_id: string | null
          source_name: string
          source_url: string
          status: string
          triage_state: string
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          created_at: string
          deadline?: string | null
          family: string
          fit_score?: number | null
          id: string
          opportunity_type: string
          payload: Json
          research_case_id?: string | null
          source_name: string
          source_url: string
          status: string
          triage_state?: string
          updated_at: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          created_at?: string
          deadline?: string | null
          family?: string
          fit_score?: number | null
          id?: string
          opportunity_type?: string
          payload?: Json
          research_case_id?: string | null
          source_name?: string
          source_url?: string
          status?: string
          triage_state?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      jhadina_opportunities_legacy_20260828: {
        Row: {
          buyer: Json | null
          created_at: string
          deadline: string | null
          description: string
          economics: Json
          evidence: Json
          id: string
          match: Json | null
          opportunity_class: string
          outcome: Json | null
          problem: string | null
          requires_approval: boolean
          score: Json | null
          source_external_id: string | null
          source_name: string
          source_type: string
          source_url: string | null
          status: string
          strategy: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          buyer?: Json | null
          created_at: string
          deadline?: string | null
          description: string
          economics?: Json
          evidence?: Json
          id: string
          match?: Json | null
          opportunity_class: string
          outcome?: Json | null
          problem?: string | null
          requires_approval?: boolean
          score?: Json | null
          source_external_id?: string | null
          source_name: string
          source_type: string
          source_url?: string | null
          status: string
          strategy: string
          title: string
          updated_at: string
          user_id: string
        }
        Update: {
          buyer?: Json | null
          created_at?: string
          deadline?: string | null
          description?: string
          economics?: Json
          evidence?: Json
          id?: string
          match?: Json | null
          opportunity_class?: string
          outcome?: Json | null
          problem?: string | null
          requires_approval?: boolean
          score?: Json | null
          source_external_id?: string | null
          source_name?: string
          source_type?: string
          source_url?: string | null
          status?: string
          strategy?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      jhadina_opportunity_observations: {
        Row: {
          captured_at: string
          created_at: string
          id: string
          observed_status: string
          opportunity_id: string
          payload: Json
          source_id: string | null
          source_name: string
          source_url: string
          user_id: string
        }
        Insert: {
          captured_at: string
          created_at?: string
          id: string
          observed_status: string
          opportunity_id: string
          payload: Json
          source_id?: string | null
          source_name: string
          source_url: string
          user_id: string
        }
        Update: {
          captured_at?: string
          created_at?: string
          id?: string
          observed_status?: string
          opportunity_id?: string
          payload?: Json
          source_id?: string | null
          source_name?: string
          source_url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jhadina_opportunity_observations_user_id_opportunity_id_fkey"
            columns: ["user_id", "opportunity_id"]
            isOneToOne: false
            referencedRelation: "jhadina_opportunities"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      jhadina_opportunity_outbox: {
        Row: {
          created_at: string
          event_id: string
          event_type: string
          opportunity_id: string
          payload: Json
          published_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          event_type: string
          opportunity_id: string
          payload: Json
          published_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          event_type?: string
          opportunity_id?: string
          payload?: Json
          published_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jhadina_opportunity_outbox_user_id_opportunity_id_fkey"
            columns: ["user_id", "opportunity_id"]
            isOneToOne: false
            referencedRelation: "jhadina_opportunities"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      jhadina_opportunity_outcomes: {
        Row: {
          action_ref: string | null
          created_at: string
          currency: string
          direct_costs: number
          dollars_per_hour: number | null
          evidence_refs: Json
          execution_ref: string | null
          fees: number
          gross_revenue: number
          hours: number
          id: string
          margin: number | null
          net_revenue: number
          observed_at: string
          opportunity_id: string
          payload: Json
          profit: number
          refunds: number
          result: string
          source_owner: string
          total_costs: number
          transaction_refs: Json
          user_id: string
        }
        Insert: {
          action_ref?: string | null
          created_at?: string
          currency: string
          direct_costs: number
          dollars_per_hour?: number | null
          evidence_refs: Json
          execution_ref?: string | null
          fees: number
          gross_revenue: number
          hours: number
          id: string
          margin?: number | null
          net_revenue: number
          observed_at: string
          opportunity_id: string
          payload: Json
          profit: number
          refunds: number
          result: string
          source_owner: string
          total_costs: number
          transaction_refs?: Json
          user_id: string
        }
        Update: {
          action_ref?: string | null
          created_at?: string
          currency?: string
          direct_costs?: number
          dollars_per_hour?: number | null
          evidence_refs?: Json
          execution_ref?: string | null
          fees?: number
          gross_revenue?: number
          hours?: number
          id?: string
          margin?: number | null
          net_revenue?: number
          observed_at?: string
          opportunity_id?: string
          payload?: Json
          profit?: number
          refunds?: number
          result?: string
          source_owner?: string
          total_costs?: number
          transaction_refs?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jhadina_opportunity_outcomes_user_id_opportunity_id_fkey"
            columns: ["user_id", "opportunity_id"]
            isOneToOne: false
            referencedRelation: "jhadina_opportunities"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      jhadina_opportunity_reconciliations: {
        Row: {
          created_at: string
          decision: string
          id: string
          incoming_status: string
          observation_id: string
          opportunity_id: string
          preserved_status: string
          reason: string
          user_id: string
        }
        Insert: {
          created_at?: string
          decision: string
          id: string
          incoming_status: string
          observation_id: string
          opportunity_id: string
          preserved_status: string
          reason: string
          user_id: string
        }
        Update: {
          created_at?: string
          decision?: string
          id?: string
          incoming_status?: string
          observation_id?: string
          opportunity_id?: string
          preserved_status?: string
          reason?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jhadina_opportunity_reconciliations_user_id_observation_id_fkey"
            columns: ["user_id", "observation_id"]
            isOneToOne: false
            referencedRelation: "jhadina_opportunity_observations"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "jhadina_opportunity_reconciliations_user_id_opportunity_id_fkey"
            columns: ["user_id", "opportunity_id"]
            isOneToOne: false
            referencedRelation: "jhadina_opportunities"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      jhadina_opportunity_research_cases: {
        Row: {
          created_at: string
          id: string
          opportunity_id: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at: string
          id: string
          opportunity_id: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          opportunity_id?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jhadina_opportunity_research_cases_user_id_opportunity_id_fkey"
            columns: ["user_id", "opportunity_id"]
            isOneToOne: true
            referencedRelation: "jhadina_opportunities"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      jhadina_opportunity_research_tasks: {
        Row: {
          completed_at: string | null
          created_at: string
          evidence_refs: Json
          id: string
          kind: string
          required: boolean
          research_case_id: string
          status: string
          title: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at: string
          evidence_refs?: Json
          id: string
          kind: string
          required?: boolean
          research_case_id: string
          status: string
          title: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          evidence_refs?: Json
          id?: string
          kind?: string
          required?: boolean
          research_case_id?: string
          status?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jhadina_opportunity_research_task_user_id_research_case_id_fkey"
            columns: ["user_id", "research_case_id"]
            isOneToOne: false
            referencedRelation: "jhadina_opportunity_research_cases"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      jhadina_personality_states: {
        Row: {
          created_at: string
          profile_id: string
          state: Json
          version: number
        }
        Insert: {
          created_at?: string
          profile_id: string
          state: Json
          version: number
        }
        Update: {
          created_at?: string
          profile_id?: string
          state?: Json
          version?: number
        }
        Relationships: []
      }
      jhadina_planning_events: {
        Row: {
          created_by: string | null
          event_data: Json
          event_type: string
          id: string
          occurred_at: string
          plan_id: string
        }
        Insert: {
          created_by?: string | null
          event_data?: Json
          event_type: string
          id?: string
          occurred_at?: string
          plan_id: string
        }
        Update: {
          created_by?: string | null
          event_data?: Json
          event_type?: string
          id?: string
          occurred_at?: string
          plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jhadina_planning_events_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "jhadina_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      jhadina_planning_proposals: {
        Row: {
          action_type: string
          description: string
          evaluated_at: string | null
          id: string
          payload: Json
          plan_id: string
          policy_reason: string | null
          policy_status: string
          requested_at: string
          requested_by: string
        }
        Insert: {
          action_type: string
          description: string
          evaluated_at?: string | null
          id?: string
          payload?: Json
          plan_id: string
          policy_reason?: string | null
          policy_status?: string
          requested_at?: string
          requested_by: string
        }
        Update: {
          action_type?: string
          description?: string
          evaluated_at?: string | null
          id?: string
          payload?: Json
          plan_id?: string
          policy_reason?: string | null
          policy_status?: string
          requested_at?: string
          requested_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "jhadina_planning_proposals_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "jhadina_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      jhadina_plans: {
        Row: {
          created_at: string
          id: string
          metadata: Json
          name: string
          plan: Json
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json
          name: string
          plan?: Json
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json
          name?: string
          plan?: Json
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      jhadina_reasoning_events: {
        Row: {
          candidate_id: string | null
          classification: Json
          confidence: number
          created_at: string
          id: string
          observation: Json
          occurred_at: string
          system_response: string
          user_id: string
          user_message: string
        }
        Insert: {
          candidate_id?: string | null
          classification?: Json
          confidence: number
          created_at?: string
          id: string
          observation?: Json
          occurred_at: string
          system_response: string
          user_id: string
          user_message: string
        }
        Update: {
          candidate_id?: string | null
          classification?: Json
          confidence?: number
          created_at?: string
          id?: string
          observation?: Json
          occurred_at?: string
          system_response?: string
          user_id?: string
          user_message?: string
        }
        Relationships: []
      }
      jhadina_regret_memory: {
        Row: {
          created_at: string
          id: string
          memory_id: string
          provenance: Json
          regret: Json
          salience: number
          superseded_by: string | null
          supersedes: string | null
          tags: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          memory_id: string
          provenance?: Json
          regret: Json
          salience?: number
          superseded_by?: string | null
          supersedes?: string | null
          tags?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          memory_id?: string
          provenance?: Json
          regret?: Json
          salience?: number
          superseded_by?: string | null
          supersedes?: string | null
          tags?: Json
          user_id?: string
        }
        Relationships: []
      }
      jhadina_research_evidence_lineage: {
        Row: {
          created_at: string
          evidence_id: string
          execution_event_id: string
          plan_id: string
          task_id: string | null
        }
        Insert: {
          created_at?: string
          evidence_id: string
          execution_event_id: string
          plan_id: string
          task_id?: string | null
        }
        Update: {
          created_at?: string
          evidence_id?: string
          execution_event_id?: string
          plan_id?: string
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jhadina_research_evidence_lineage_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: true
            referencedRelation: "jhadina_knowledge_evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jhadina_research_evidence_lineage_execution_event_id_fkey"
            columns: ["execution_event_id"]
            isOneToOne: false
            referencedRelation: "jhadina_research_execution_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jhadina_research_evidence_lineage_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "jhadina_research_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      jhadina_research_execution_events: {
        Row: {
          actual_usage: Json
          content_hash: string | null
          created_at: string
          event_type: string
          expected_budget: Json
          id: string
          lease_id: string | null
          occurred_at: string
          payload: Json
          plan_id: string
          result_status: string | null
          sequence_no: number
          task_id: string | null
        }
        Insert: {
          actual_usage?: Json
          content_hash?: string | null
          created_at?: string
          event_type: string
          expected_budget?: Json
          id?: string
          lease_id?: string | null
          occurred_at?: string
          payload?: Json
          plan_id: string
          result_status?: string | null
          sequence_no: number
          task_id?: string | null
        }
        Update: {
          actual_usage?: Json
          content_hash?: string | null
          created_at?: string
          event_type?: string
          expected_budget?: Json
          id?: string
          lease_id?: string | null
          occurred_at?: string
          payload?: Json
          plan_id?: string
          result_status?: string | null
          sequence_no?: number
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jhadina_research_execution_events_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "jhadina_research_execution_leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jhadina_research_execution_events_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "jhadina_research_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      jhadina_research_execution_leases: {
        Row: {
          accrued_risk: number
          acquired_at: string
          attempt_count: number
          bounds_snapshot: Json
          budget_snapshot: Json
          created_at: string
          evidence_count: number
          expires_at: string
          id: string
          last_sequence_no: number
          lease_token: string
          lineage: Json
          max_breadth_seen: number
          max_depth_seen: number
          plan_id: string
          policy_decision_id: string
          query_count: number
          released_at: string | null
          renewed_at: string | null
          retry_count: number
          source_count: number
          spent_cost: number
          state: string
          updated_at: string
          wall_clock_ms: number
          worker_id: string
        }
        Insert: {
          accrued_risk?: number
          acquired_at?: string
          attempt_count?: number
          bounds_snapshot?: Json
          budget_snapshot?: Json
          created_at?: string
          evidence_count?: number
          expires_at: string
          id?: string
          last_sequence_no?: number
          lease_token: string
          lineage?: Json
          max_breadth_seen?: number
          max_depth_seen?: number
          plan_id: string
          policy_decision_id: string
          query_count?: number
          released_at?: string | null
          renewed_at?: string | null
          retry_count?: number
          source_count?: number
          spent_cost?: number
          state?: string
          updated_at?: string
          wall_clock_ms?: number
          worker_id: string
        }
        Update: {
          accrued_risk?: number
          acquired_at?: string
          attempt_count?: number
          bounds_snapshot?: Json
          budget_snapshot?: Json
          created_at?: string
          evidence_count?: number
          expires_at?: string
          id?: string
          last_sequence_no?: number
          lease_token?: string
          lineage?: Json
          max_breadth_seen?: number
          max_depth_seen?: number
          plan_id?: string
          policy_decision_id?: string
          query_count?: number
          released_at?: string | null
          renewed_at?: string | null
          retry_count?: number
          source_count?: number
          spent_cost?: number
          state?: string
          updated_at?: string
          wall_clock_ms?: number
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jhadina_research_execution_leases_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "jhadina_research_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jhadina_research_execution_leases_policy_decision_id_fkey"
            columns: ["policy_decision_id"]
            isOneToOne: false
            referencedRelation: "jhadina_research_policy_decisions"
            referencedColumns: ["id"]
          },
        ]
      }
      jhadina_research_intent_decompositions: {
        Row: {
          assumptions: Json
          claims_to_test: Json
          classifier_confidence: number | null
          content_hash: string | null
          created_at: string
          decomposition_version: number
          evidence_requirements: Json
          id: string
          objective: string
          questions: Json
          research_intent_id: string
          search_dimensions: Json
          status: string
          stopping_criteria: Json
          unresolved_ambiguities: Json
          updated_at: string
        }
        Insert: {
          assumptions?: Json
          claims_to_test?: Json
          classifier_confidence?: number | null
          content_hash?: string | null
          created_at?: string
          decomposition_version?: number
          evidence_requirements?: Json
          id?: string
          objective: string
          questions?: Json
          research_intent_id: string
          search_dimensions?: Json
          status?: string
          stopping_criteria?: Json
          unresolved_ambiguities?: Json
          updated_at?: string
        }
        Update: {
          assumptions?: Json
          claims_to_test?: Json
          classifier_confidence?: number | null
          content_hash?: string | null
          created_at?: string
          decomposition_version?: number
          evidence_requirements?: Json
          id?: string
          objective?: string
          questions?: Json
          research_intent_id?: string
          search_dimensions?: Json
          status?: string
          stopping_criteria?: Json
          unresolved_ambiguities?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jhadina_research_intent_decompositions_research_intent_id_fkey"
            columns: ["research_intent_id"]
            isOneToOne: false
            referencedRelation: "jhadina_research_intents"
            referencedColumns: ["id"]
          },
        ]
      }
      jhadina_research_intents: {
        Row: {
          assumptions: Json
          claims_to_test: Json
          classification: Json
          created_at: string
          dedupe_key: string | null
          evidence_requirements: Json
          id: string
          intent_type: string
          knowledge_record_id: string | null
          objective: string
          objectivity_requirements: Json
          policy_requirements: Json
          questions: Json
          scope: Json
          search_strategy: Json
          status: string
          trigger_id: string | null
          updated_at: string
        }
        Insert: {
          assumptions?: Json
          claims_to_test?: Json
          classification?: Json
          created_at?: string
          dedupe_key?: string | null
          evidence_requirements?: Json
          id?: string
          intent_type: string
          knowledge_record_id?: string | null
          objective: string
          objectivity_requirements?: Json
          policy_requirements?: Json
          questions?: Json
          scope?: Json
          search_strategy?: Json
          status?: string
          trigger_id?: string | null
          updated_at?: string
        }
        Update: {
          assumptions?: Json
          claims_to_test?: Json
          classification?: Json
          created_at?: string
          dedupe_key?: string | null
          evidence_requirements?: Json
          id?: string
          intent_type?: string
          knowledge_record_id?: string | null
          objective?: string
          objectivity_requirements?: Json
          policy_requirements?: Json
          questions?: Json
          scope?: Json
          search_strategy?: Json
          status?: string
          trigger_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jhadina_research_intents_knowledge_record_id_fkey"
            columns: ["knowledge_record_id"]
            isOneToOne: false
            referencedRelation: "jhadina_knowledge_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jhadina_research_intents_trigger_id_fkey"
            columns: ["trigger_id"]
            isOneToOne: false
            referencedRelation: "jhadina_research_revalidation_triggers"
            referencedColumns: ["id"]
          },
        ]
      }
      jhadina_research_plans: {
        Row: {
          breadth: number
          budget: Json
          content_hash: string | null
          contradiction_checks: Json
          created_at: string
          decomposition_id: string
          depth: number
          evidence_requirements: Json
          id: string
          intent_id: string
          plan_version: number
          policy_requirements: Json
          policy_snapshot: Json
          source_constraints: Json
          status: string
          stopping_criteria: Json
          tasks: Json
          updated_at: string
        }
        Insert: {
          breadth?: number
          budget?: Json
          content_hash?: string | null
          contradiction_checks?: Json
          created_at?: string
          decomposition_id: string
          depth?: number
          evidence_requirements?: Json
          id?: string
          intent_id: string
          plan_version?: number
          policy_requirements?: Json
          policy_snapshot?: Json
          source_constraints?: Json
          status?: string
          stopping_criteria?: Json
          tasks?: Json
          updated_at?: string
        }
        Update: {
          breadth?: number
          budget?: Json
          content_hash?: string | null
          contradiction_checks?: Json
          created_at?: string
          decomposition_id?: string
          depth?: number
          evidence_requirements?: Json
          id?: string
          intent_id?: string
          plan_version?: number
          policy_requirements?: Json
          policy_snapshot?: Json
          source_constraints?: Json
          status?: string
          stopping_criteria?: Json
          tasks?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jhadina_research_plans_decomposition_id_fkey"
            columns: ["decomposition_id"]
            isOneToOne: false
            referencedRelation: "jhadina_research_intent_decompositions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jhadina_research_plans_intent_id_fkey"
            columns: ["intent_id"]
            isOneToOne: false
            referencedRelation: "jhadina_research_intents"
            referencedColumns: ["id"]
          },
        ]
      }
      jhadina_research_policy_decisions: {
        Row: {
          action_proposal_id: string | null
          admitted_for_execution: boolean
          approval_mode: string
          audit_receipt_id: string | null
          capability: string | null
          constraints: Json
          created_at: string
          decision: string
          evaluated_at: string
          evaluator_version: string
          id: string
          plan_id: string
          policy_version: string
          reasons: Json
          required_authorities: Json
          required_capabilities: Json
        }
        Insert: {
          action_proposal_id?: string | null
          admitted_for_execution?: boolean
          approval_mode?: string
          audit_receipt_id?: string | null
          capability?: string | null
          constraints?: Json
          created_at?: string
          decision: string
          evaluated_at?: string
          evaluator_version: string
          id?: string
          plan_id: string
          policy_version: string
          reasons?: Json
          required_authorities?: Json
          required_capabilities?: Json
        }
        Update: {
          action_proposal_id?: string | null
          admitted_for_execution?: boolean
          approval_mode?: string
          audit_receipt_id?: string | null
          capability?: string | null
          constraints?: Json
          created_at?: string
          decision?: string
          evaluated_at?: string
          evaluator_version?: string
          id?: string
          plan_id?: string
          policy_version?: string
          reasons?: Json
          required_authorities?: Json
          required_capabilities?: Json
        }
        Relationships: [
          {
            foreignKeyName: "jhadina_research_policy_decisions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "jhadina_research_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jhadina_research_policy_receipt_fk"
            columns: ["audit_receipt_id"]
            isOneToOne: false
            referencedRelation: "jhadina_execution_receipts"
            referencedColumns: ["receipt_id"]
          },
        ]
      }
      jhadina_research_provider_submissions: {
        Row: {
          attempt: number
          created_at: string
          id: string
          idempotency_key: string
          last_error: string | null
          lease_id: string
          plan_id: string
          provider_id: string
          provider_job_id: string | null
          request_hash: string
          status: string
          task_id: string
          updated_at: string
          worker_id: string
        }
        Insert: {
          attempt?: number
          created_at?: string
          id?: string
          idempotency_key: string
          last_error?: string | null
          lease_id: string
          plan_id: string
          provider_id: string
          provider_job_id?: string | null
          request_hash: string
          status?: string
          task_id: string
          updated_at?: string
          worker_id: string
        }
        Update: {
          attempt?: number
          created_at?: string
          id?: string
          idempotency_key?: string
          last_error?: string | null
          lease_id?: string
          plan_id?: string
          provider_id?: string
          provider_job_id?: string | null
          request_hash?: string
          status?: string
          task_id?: string
          updated_at?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jhadina_research_provider_submissions_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "jhadina_research_execution_leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jhadina_research_provider_submissions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "jhadina_research_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      jhadina_research_revalidation_triggers: {
        Row: {
          created_at: string
          dedupe_key: string
          freshness_state: string
          id: string
          knowledge_record_id: string
          max_breadth: number
          max_depth: number
          policy_requirements: Json
          required_authority: string
          research_intent_id: string | null
          research_scope: Json
          status: string
          trigger_reason: string
          triggering_evidence_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          dedupe_key: string
          freshness_state: string
          id?: string
          knowledge_record_id: string
          max_breadth?: number
          max_depth?: number
          policy_requirements?: Json
          required_authority?: string
          research_intent_id?: string | null
          research_scope?: Json
          status?: string
          trigger_reason: string
          triggering_evidence_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          dedupe_key?: string
          freshness_state?: string
          id?: string
          knowledge_record_id?: string
          max_breadth?: number
          max_depth?: number
          policy_requirements?: Json
          required_authority?: string
          research_intent_id?: string | null
          research_scope?: Json
          status?: string
          trigger_reason?: string
          triggering_evidence_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jhadina_research_revalidation_trigg_triggering_evidence_id_fkey"
            columns: ["triggering_evidence_id"]
            isOneToOne: false
            referencedRelation: "jhadina_knowledge_evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jhadina_research_revalidation_triggers_knowledge_record_id_fkey"
            columns: ["knowledge_record_id"]
            isOneToOne: false
            referencedRelation: "jhadina_knowledge_records"
            referencedColumns: ["id"]
          },
        ]
      }
      jhadina_research_source_performance: {
        Row: {
          corroborated_evidence: number
          decayed_score: number
          investigations: number
          performance_policy_version: number
          posterior_lower_bound: number
          posterior_mean: number
          posterior_upper_bound: number
          rejected_evidence: number
          score: number
          source_id: string
          updated_at: string
          useful_evidence: number
          verified_evidence: number
        }
        Insert: {
          corroborated_evidence?: number
          decayed_score?: number
          investigations?: number
          performance_policy_version?: number
          posterior_lower_bound?: number
          posterior_mean?: number
          posterior_upper_bound?: number
          rejected_evidence?: number
          score?: number
          source_id: string
          updated_at?: string
          useful_evidence?: number
          verified_evidence?: number
        }
        Update: {
          corroborated_evidence?: number
          decayed_score?: number
          investigations?: number
          performance_policy_version?: number
          posterior_lower_bound?: number
          posterior_mean?: number
          posterior_upper_bound?: number
          rejected_evidence?: number
          score?: number
          source_id?: string
          updated_at?: string
          useful_evidence?: number
          verified_evidence?: number
        }
        Relationships: []
      }
      jhadina_research_source_performance_policy: {
        Row: {
          exploration_weight: number
          half_life_days: number
          minimum_score: number
          policy_key: string
          policy_version: number
          prior_alpha: number
          prior_beta: number
          updated_at: string
        }
        Insert: {
          exploration_weight: number
          half_life_days: number
          minimum_score: number
          policy_key: string
          policy_version: number
          prior_alpha: number
          prior_beta: number
          updated_at?: string
        }
        Update: {
          exploration_weight?: number
          half_life_days?: number
          minimum_score?: number
          policy_key?: string
          policy_version?: number
          prior_alpha?: number
          prior_beta?: number
          updated_at?: string
        }
        Relationships: []
      }
      jhadina_research_task_states: {
        Row: {
          accrued_risk: number
          attempt_count: number
          completed_at: string | null
          evidence_ids: Json
          last_lease_id: string | null
          plan_id: string
          spent_cost: number
          started_at: string | null
          state: string
          task_id: string
          updated_at: string
        }
        Insert: {
          accrued_risk?: number
          attempt_count?: number
          completed_at?: string | null
          evidence_ids?: Json
          last_lease_id?: string | null
          plan_id: string
          spent_cost?: number
          started_at?: string | null
          state?: string
          task_id: string
          updated_at?: string
        }
        Update: {
          accrued_risk?: number
          attempt_count?: number
          completed_at?: string | null
          evidence_ids?: Json
          last_lease_id?: string | null
          plan_id?: string
          spent_cost?: number
          started_at?: string | null
          state?: string
          task_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jhadina_research_task_states_last_lease_id_fkey"
            columns: ["last_lease_id"]
            isOneToOne: false
            referencedRelation: "jhadina_research_execution_leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jhadina_research_task_states_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "jhadina_research_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      jhadina_shark_market_events: {
        Row: {
          chain_id: string
          created_at: string
          event_id: string
          event_type: string
          observation_id: string
          occurred_at: string
          payload: Json
          provenance: Json
          received_at: string
          sequence: number
          source: string
          source_ref: string | null
          subject_id: string
        }
        Insert: {
          chain_id: string
          created_at?: string
          event_id: string
          event_type: string
          observation_id: string
          occurred_at: string
          payload?: Json
          provenance?: Json
          received_at: string
          sequence?: never
          source: string
          source_ref?: string | null
          subject_id: string
        }
        Update: {
          chain_id?: string
          created_at?: string
          event_id?: string
          event_type?: string
          observation_id?: string
          occurred_at?: string
          payload?: Json
          provenance?: Json
          received_at?: string
          sequence?: never
          source?: string
          source_ref?: string | null
          subject_id?: string
        }
        Relationships: []
      }
      jhadina_sniper_candidates: {
        Row: {
          behavior_signals: Json
          blockers: Json
          candidate_id: string
          chain_id: string
          cluster_id: string | null
          created_at: string
          developer_entity_id: string | null
          developer_wallet_id: string | null
          disposition: string
          evidence_ids: Json
          launch_id: string
          observed_at: string
          owner_id: string | null
          reasons: Json
          score: number
          token_address: string
          updated_at: string
          version: string
        }
        Insert: {
          behavior_signals?: Json
          blockers?: Json
          candidate_id: string
          chain_id: string
          cluster_id?: string | null
          created_at?: string
          developer_entity_id?: string | null
          developer_wallet_id?: string | null
          disposition: string
          evidence_ids?: Json
          launch_id: string
          observed_at: string
          owner_id?: string | null
          reasons?: Json
          score: number
          token_address: string
          updated_at?: string
          version: string
        }
        Update: {
          behavior_signals?: Json
          blockers?: Json
          candidate_id?: string
          chain_id?: string
          cluster_id?: string | null
          created_at?: string
          developer_entity_id?: string | null
          developer_wallet_id?: string | null
          disposition?: string
          evidence_ids?: Json
          launch_id?: string
          observed_at?: string
          owner_id?: string | null
          reasons?: Json
          score?: number
          token_address?: string
          updated_at?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "jhadina_sniper_candidates_launch_id_fkey"
            columns: ["launch_id"]
            isOneToOne: false
            referencedRelation: "jhadina_token_launches"
            referencedColumns: ["launch_id"]
          },
        ]
      }
      jhadina_spatial_evidence: {
        Row: {
          adapter: string
          adapter_version: string
          attribution: string | null
          completeness: string
          content_hash: string
          coverage: string
          created_at: string
          evidence_id: string
          freshness: string
          observation_id: string
          observed_at: string | null
          payload: Json
          provider: string
          received_at: string
          record_id: string | null
        }
        Insert: {
          adapter: string
          adapter_version: string
          attribution?: string | null
          completeness: string
          content_hash: string
          coverage: string
          created_at?: string
          evidence_id: string
          freshness: string
          observation_id: string
          observed_at?: string | null
          payload: Json
          provider: string
          received_at: string
          record_id?: string | null
        }
        Update: {
          adapter?: string
          adapter_version?: string
          attribution?: string | null
          completeness?: string
          content_hash?: string
          coverage?: string
          created_at?: string
          evidence_id?: string
          freshness?: string
          observation_id?: string
          observed_at?: string | null
          payload?: Json
          provider?: string
          received_at?: string
          record_id?: string | null
        }
        Relationships: []
      }
      jhadina_spatial_reality_admissions: {
        Row: {
          admission_id: string
          candidate_id: string
          created_at: string
          decision: string
          evidence_refs: Json
          rationale: Json
          verifier: string
        }
        Insert: {
          admission_id: string
          candidate_id: string
          created_at: string
          decision: string
          evidence_refs?: Json
          rationale?: Json
          verifier: string
        }
        Update: {
          admission_id?: string
          candidate_id?: string
          created_at?: string
          decision?: string
          evidence_refs?: Json
          rationale?: Json
          verifier?: string
        }
        Relationships: [
          {
            foreignKeyName: "jhadina_spatial_reality_admissions_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "jhadina_spatial_reality_candidates"
            referencedColumns: ["candidate_id"]
          },
        ]
      }
      jhadina_spatial_reality_candidates: {
        Row: {
          candidate_id: string
          created_at: string
          determination: string
          entity_id: string
          evidence_refs: Json
          fusion_refs: Json
          limitations: Json
          observation_refs: Json
          state: Json
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          candidate_id: string
          created_at: string
          determination: string
          entity_id: string
          evidence_refs?: Json
          fusion_refs?: Json
          limitations?: Json
          observation_refs?: Json
          state?: Json
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          candidate_id?: string
          created_at?: string
          determination?: string
          entity_id?: string
          evidence_refs?: Json
          fusion_refs?: Json
          limitations?: Json
          observation_refs?: Json
          state?: Json
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: []
      }
      jhadina_spatial_workspace_revisions: {
        Row: {
          captured_at: string
          created_at: string
          owner_id: string
          reason: string
          revision_id: string
          snapshot: Json
          workspace_id: string
        }
        Insert: {
          captured_at: string
          created_at?: string
          owner_id: string
          reason: string
          revision_id: string
          snapshot: Json
          workspace_id: string
        }
        Update: {
          captured_at?: string
          created_at?: string
          owner_id?: string
          reason?: string
          revision_id?: string
          snapshot?: Json
          workspace_id?: string
        }
        Relationships: []
      }
      jhadina_timeline_events: {
        Row: {
          created_at: string
          decision: string | null
          id: string
          memory_content: string | null
          memory_id: string | null
          memory_type: string | null
          occurred_at: string
          reasoning_event_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          decision?: string | null
          id: string
          memory_content?: string | null
          memory_id?: string | null
          memory_type?: string | null
          occurred_at: string
          reasoning_event_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          decision?: string | null
          id?: string
          memory_content?: string | null
          memory_id?: string | null
          memory_type?: string | null
          occurred_at?: string
          reasoning_event_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      jhadina_token_launches: {
        Row: {
          chain_id: string
          cluster_id: string | null
          created_at: string
          deployer_wallet_id: string | null
          developer_entity_id: string | null
          evidence_ids: Json
          initial_liquidity_usd: number | null
          launch_id: string
          launched_at: string
          launchpad: string | null
          outcome: string
          outcome_observed_at: string | null
          owner_id: string | null
          token_address: string
          updated_at: string
        }
        Insert: {
          chain_id: string
          cluster_id?: string | null
          created_at?: string
          deployer_wallet_id?: string | null
          developer_entity_id?: string | null
          evidence_ids?: Json
          initial_liquidity_usd?: number | null
          launch_id: string
          launched_at: string
          launchpad?: string | null
          outcome?: string
          outcome_observed_at?: string | null
          owner_id?: string | null
          token_address: string
          updated_at?: string
        }
        Update: {
          chain_id?: string
          cluster_id?: string | null
          created_at?: string
          deployer_wallet_id?: string | null
          developer_entity_id?: string | null
          evidence_ids?: Json
          initial_liquidity_usd?: number | null
          launch_id?: string
          launched_at?: string
          launchpad?: string | null
          outcome?: string
          outcome_observed_at?: string | null
          owner_id?: string | null
          token_address?: string
          updated_at?: string
        }
        Relationships: []
      }
      jhadina_wallet_challenges: {
        Row: {
          chain: string
          challenge_id: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          message: string
          nonce: string
          owner_id: string
          provider: string
          wallet_address: string
        }
        Insert: {
          chain: string
          challenge_id?: string
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          message: string
          nonce: string
          owner_id: string
          provider: string
          wallet_address: string
        }
        Update: {
          chain?: string
          challenge_id?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          message?: string
          nonce?: string
          owner_id?: string
          provider?: string
          wallet_address?: string
        }
        Relationships: []
      }
      jhadina_wallet_entities: {
        Row: {
          confidence: number
          created_at: string
          entity_id: string
          entity_kind: string
          entity_link_id: string
          evidence_ids: Json
          observed_at: string
          owner_id: string | null
          role: string
          wallet_id: string
        }
        Insert: {
          confidence: number
          created_at?: string
          entity_id: string
          entity_kind: string
          entity_link_id?: string
          evidence_ids?: Json
          observed_at: string
          owner_id?: string | null
          role: string
          wallet_id: string
        }
        Update: {
          confidence?: number
          created_at?: string
          entity_id?: string
          entity_kind?: string
          entity_link_id?: string
          evidence_ids?: Json
          observed_at?: string
          owner_id?: string | null
          role?: string
          wallet_id?: string
        }
        Relationships: []
      }
      jhadina_wallet_intelligence_observations: {
        Row: {
          created_at: string
          observation_id: string
          observed_at: string
          owner_id: string
          payload: Json
          source: string
          wallet_id: string
        }
        Insert: {
          created_at?: string
          observation_id: string
          observed_at: string
          owner_id: string
          payload: Json
          source: string
          wallet_id: string
        }
        Update: {
          created_at?: string
          observation_id?: string
          observed_at?: string
          owner_id?: string
          payload?: Json
          source?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jhadina_wallet_intelligence_observations_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "jhadina_wallets"
            referencedColumns: ["wallet_id"]
          },
        ]
      }
      jhadina_wallets: {
        Row: {
          address: string
          chain: string
          created_at: string
          observation_enabled: boolean
          owner_id: string
          ownership_verified: boolean
          ownership_verified_at: string | null
          provider: string
          trading_enabled: boolean
          updated_at: string
          wallet_id: string
        }
        Insert: {
          address: string
          chain: string
          created_at?: string
          observation_enabled?: boolean
          owner_id: string
          ownership_verified?: boolean
          ownership_verified_at?: string | null
          provider: string
          trading_enabled?: boolean
          updated_at?: string
          wallet_id?: string
        }
        Update: {
          address?: string
          chain?: string
          created_at?: string
          observation_enabled?: boolean
          owner_id?: string
          ownership_verified?: boolean
          ownership_verified_at?: string | null
          provider?: string
          trading_enabled?: boolean
          updated_at?: string
          wallet_id?: string
        }
        Relationships: []
      }
      media_playback_progress: {
        Row: {
          completed: boolean
          duration_ms: number | null
          id: string
          media_id: string
          position_ms: number
          provider_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          duration_ms?: number | null
          id: string
          media_id: string
          position_ms?: number
          provider_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          duration_ms?: number | null
          id?: string
          media_id?: string
          position_ms?: number
          provider_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      money_execution_attempts: {
        Row: {
          action_fingerprint: string
          action_snapshot: Json
          attempt_id: string
          completed_at: string | null
          created_at: string
          error_code: string | null
          error_message: string | null
          idempotency_key: string
          operation: string
          permit_id: string
          provider: string
          provider_reference: string | null
          recovery_of_execution_id: string | null
          recovery_required: boolean
          request_id: string
          started_at: string
          state: string
          updated_at: string
        }
        Insert: {
          action_fingerprint: string
          action_snapshot: Json
          attempt_id?: string
          completed_at?: string | null
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          idempotency_key: string
          operation: string
          permit_id: string
          provider: string
          provider_reference?: string | null
          recovery_of_execution_id?: string | null
          recovery_required?: boolean
          request_id: string
          started_at?: string
          state: string
          updated_at?: string
        }
        Update: {
          action_fingerprint?: string
          action_snapshot?: Json
          attempt_id?: string
          completed_at?: string | null
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          idempotency_key?: string
          operation?: string
          permit_id?: string
          provider?: string
          provider_reference?: string | null
          recovery_of_execution_id?: string | null
          recovery_required?: boolean
          request_id?: string
          started_at?: string
          state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "money_execution_attempts_permit_id_fkey"
            columns: ["permit_id"]
            isOneToOne: false
            referencedRelation: "money_execution_permits"
            referencedColumns: ["permit_id"]
          },
          {
            foreignKeyName: "money_execution_attempts_recovery_of_execution_id_fkey"
            columns: ["recovery_of_execution_id"]
            isOneToOne: false
            referencedRelation: "money_execution_attempts"
            referencedColumns: ["attempt_id"]
          },
        ]
      }
      money_execution_permits: {
        Row: {
          action_fingerprint: string
          allocation_decision_id: string | null
          approval_id: string | null
          capability: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          halted_at: string | null
          issued_at: string
          nonce: string
          opportunity_id: string | null
          permit_id: string
          policy_hash: string
          policy_version: string
          provider: string
          revoked_at: string | null
          risk_decision_id: string | null
          state: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action_fingerprint: string
          allocation_decision_id?: string | null
          approval_id?: string | null
          capability: string
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          halted_at?: string | null
          issued_at: string
          nonce: string
          opportunity_id?: string | null
          permit_id: string
          policy_hash: string
          policy_version: string
          provider: string
          revoked_at?: string | null
          risk_decision_id?: string | null
          state: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action_fingerprint?: string
          allocation_decision_id?: string | null
          approval_id?: string | null
          capability?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          halted_at?: string | null
          issued_at?: string
          nonce?: string
          opportunity_id?: string | null
          permit_id?: string
          policy_hash?: string
          policy_version?: string
          provider?: string
          revoked_at?: string | null
          risk_decision_id?: string | null
          state?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      money_research_cases: {
        Row: {
          action: string
          created_at: string
          estimated_margin_percent: number
          estimated_value: number
          id: string
          opportunity_id: string
          priority: string
          source: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          action: string
          created_at?: string
          estimated_margin_percent?: number
          estimated_value?: number
          id?: string
          opportunity_id: string
          priority: string
          source?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          action?: string
          created_at?: string
          estimated_margin_percent?: number
          estimated_value?: number
          id?: string
          opportunity_id?: string
          priority?: string
          source?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      money_research_evidence: {
        Row: {
          captured_at: string
          confidence: number | null
          finding: string
          id: string
          source: string
          task_id: string
        }
        Insert: {
          captured_at?: string
          confidence?: number | null
          finding: string
          id?: string
          source: string
          task_id: string
        }
        Update: {
          captured_at?: string
          confidence?: number | null
          finding?: string
          id?: string
          source?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "money_research_evidence_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "money_research_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      money_research_tasks: {
        Row: {
          branch: string
          created_at: string
          id: string
          priority: number
          question: string
          research_case_id: string
          status: string
          updated_at: string
        }
        Insert: {
          branch: string
          created_at?: string
          id?: string
          priority?: number
          question: string
          research_case_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          branch?: string
          created_at?: string
          id?: string
          priority?: number
          question?: string
          research_case_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "money_research_tasks_research_case_id_fkey"
            columns: ["research_case_id"]
            isOneToOne: false
            referencedRelation: "money_research_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      oce_alert_deliveries: {
        Row: {
          alert_id: string
          attempt: number
          channel: string
          claimed_at: string | null
          claimed_by: string | null
          created_at: string
          dead_lettered_at: string | null
          id: string
          idempotency_key: string
          last_error: string | null
          max_attempts: number
          next_attempt_at: string | null
          payload: Json
          priority: string
          recipient_id: string
          status: string
          updated_at: string
        }
        Insert: {
          alert_id: string
          attempt?: number
          channel: string
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          dead_lettered_at?: string | null
          id: string
          idempotency_key: string
          last_error?: string | null
          max_attempts?: number
          next_attempt_at?: string | null
          payload?: Json
          priority: string
          recipient_id: string
          status: string
          updated_at?: string
        }
        Update: {
          alert_id?: string
          attempt?: number
          channel?: string
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          dead_lettered_at?: string | null
          id?: string
          idempotency_key?: string
          last_error?: string | null
          max_attempts?: number
          next_attempt_at?: string | null
          payload?: Json
          priority?: string
          recipient_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "oce_alert_deliveries_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "oce_alert_events"
            referencedColumns: ["id"]
          },
        ]
      }
      oce_alert_events: {
        Row: {
          alert_type: string
          change_reason: string
          created_at: string
          detected_at: string
          engine_version: string
          fingerprint: string
          id: string
          new_state: Json | null
          opportunity_id: string
          previous_state: Json | null
          principal_id: string | null
          priority: string
          supporting_evidence_ids: Json
          watchlist_entry_id: string
        }
        Insert: {
          alert_type: string
          change_reason: string
          created_at?: string
          detected_at: string
          engine_version: string
          fingerprint: string
          id: string
          new_state?: Json | null
          opportunity_id: string
          previous_state?: Json | null
          principal_id?: string | null
          priority: string
          supporting_evidence_ids?: Json
          watchlist_entry_id: string
        }
        Update: {
          alert_type?: string
          change_reason?: string
          created_at?: string
          detected_at?: string
          engine_version?: string
          fingerprint?: string
          id?: string
          new_state?: Json | null
          opportunity_id?: string
          previous_state?: Json | null
          principal_id?: string | null
          priority?: string
          supporting_evidence_ids?: Json
          watchlist_entry_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oce_alert_events_watchlist_entry_id_fkey"
            columns: ["watchlist_entry_id"]
            isOneToOne: false
            referencedRelation: "oce_watchlist_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      oce_feedback_events: {
        Row: {
          event_type: string
          id: string
          kind: string
          observed_at: string
          opportunity_id: string | null
          payload: Json
          principal_id: string | null
          recorded_at: string
          schema_version: number
          source_evidence_ids: Json
        }
        Insert: {
          event_type: string
          id: string
          kind: string
          observed_at: string
          opportunity_id?: string | null
          payload?: Json
          principal_id?: string | null
          recorded_at?: string
          schema_version?: number
          source_evidence_ids?: Json
        }
        Update: {
          event_type?: string
          id?: string
          kind?: string
          observed_at?: string
          opportunity_id?: string | null
          payload?: Json
          principal_id?: string | null
          recorded_at?: string
          schema_version?: number
          source_evidence_ids?: Json
        }
        Relationships: []
      }
      oce_in_app_notifications: {
        Row: {
          alert_id: string
          created_at: string
          delivery_id: string
          id: string
          payload: Json
          priority: string
          read_at: string | null
          recipient_id: string
        }
        Insert: {
          alert_id: string
          created_at?: string
          delivery_id: string
          id?: string
          payload?: Json
          priority: string
          read_at?: string | null
          recipient_id: string
        }
        Update: {
          alert_id?: string
          created_at?: string
          delivery_id?: string
          id?: string
          payload?: Json
          priority?: string
          read_at?: string | null
          recipient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oce_in_app_notifications_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "oce_alert_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oce_in_app_notifications_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "oce_alert_deliveries"
            referencedColumns: ["id"]
          },
        ]
      }
      oce_opportunities: {
        Row: {
          amount: Json | null
          brokerability: string | null
          claims: Json
          created_at: string
          deadline: string | null
          description: string | null
          effort_score: number | null
          eligibility: Json | null
          evidence: Json
          expected_value: number | null
          family: string
          fit_score: number | null
          id: string
          jurisdiction: Json | null
          opportunity_score: number | null
          requirements: Json
          risk_flags: Json
          scoring_rubric: Json | null
          source_confidence: number
          source_id: string | null
          source_identity: string
          source_name: string
          source_url: string
          status: string
          title: string
          type: string
          updated_at: string
          verification_decision: Json | null
          verification_status: string
        }
        Insert: {
          amount?: Json | null
          brokerability?: string | null
          claims?: Json
          created_at: string
          deadline?: string | null
          description?: string | null
          effort_score?: number | null
          eligibility?: Json | null
          evidence?: Json
          expected_value?: number | null
          family: string
          fit_score?: number | null
          id: string
          jurisdiction?: Json | null
          opportunity_score?: number | null
          requirements?: Json
          risk_flags?: Json
          scoring_rubric?: Json | null
          source_confidence?: number
          source_id?: string | null
          source_identity: string
          source_name: string
          source_url: string
          status?: string
          title: string
          type: string
          updated_at: string
          verification_decision?: Json | null
          verification_status?: string
        }
        Update: {
          amount?: Json | null
          brokerability?: string | null
          claims?: Json
          created_at?: string
          deadline?: string | null
          description?: string | null
          effort_score?: number | null
          eligibility?: Json | null
          evidence?: Json
          expected_value?: number | null
          family?: string
          fit_score?: number | null
          id?: string
          jurisdiction?: Json | null
          opportunity_score?: number | null
          requirements?: Json
          risk_flags?: Json
          scoring_rubric?: Json | null
          source_confidence?: number
          source_id?: string | null
          source_identity?: string
          source_name?: string
          source_url?: string
          status?: string
          title?: string
          type?: string
          updated_at?: string
          verification_decision?: Json | null
          verification_status?: string
        }
        Relationships: []
      }
      oce_versioned_assessments: {
        Row: {
          assessed_at: string
          assessment_type: string
          basis_evidence_ids: Json
          created_at: string
          engine_version: string
          id: string
          score: number
          subject_id: string
          supersedes_id: string | null
        }
        Insert: {
          assessed_at: string
          assessment_type: string
          basis_evidence_ids?: Json
          created_at?: string
          engine_version: string
          id: string
          score: number
          subject_id: string
          supersedes_id?: string | null
        }
        Update: {
          assessed_at?: string
          assessment_type?: string
          basis_evidence_ids?: Json
          created_at?: string
          engine_version?: string
          id?: string
          score?: number
          subject_id?: string
          supersedes_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "oce_versioned_assessments_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "oce_versioned_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      oce_watchlist_entries: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          opportunity_id: string
          principal_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id: string
          opportunity_id: string
          principal_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          opportunity_id?: string
          principal_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      overage_action_audit: {
        Row: {
          action_id: string
          created_at: string
          event_type: string
          id: string
          metadata: Json
          opportunity_id: string | null
          provider_ref: string | null
          safe_error_class: string | null
          status: string
        }
        Insert: {
          action_id: string
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          opportunity_id?: string | null
          provider_ref?: string | null
          safe_error_class?: string | null
          status: string
        }
        Update: {
          action_id?: string
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          opportunity_id?: string | null
          provider_ref?: string | null
          safe_error_class?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "overage_action_audit_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "overage_opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      overage_action_envelopes: {
        Row: {
          action_id: string
          action_type: string
          actor_identity_ref: string | null
          approval_ref: string | null
          capability: string
          completed_at: string | null
          expires_at: string | null
          id: string
          idempotency_key: string
          opportunity_id: string | null
          policy_decision_ref: string | null
          provenance_refs: Json
          provider_ref: string | null
          requested_at: string
          safe_error_class: string | null
          status: string
        }
        Insert: {
          action_id: string
          action_type: string
          actor_identity_ref?: string | null
          approval_ref?: string | null
          capability: string
          completed_at?: string | null
          expires_at?: string | null
          id?: string
          idempotency_key: string
          opportunity_id?: string | null
          policy_decision_ref?: string | null
          provenance_refs?: Json
          provider_ref?: string | null
          requested_at?: string
          safe_error_class?: string | null
          status?: string
        }
        Update: {
          action_id?: string
          action_type?: string
          actor_identity_ref?: string | null
          approval_ref?: string | null
          capability?: string
          completed_at?: string | null
          expires_at?: string | null
          id?: string
          idempotency_key?: string
          opportunity_id?: string | null
          policy_decision_ref?: string | null
          provenance_refs?: Json
          provider_ref?: string | null
          requested_at?: string
          safe_error_class?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "overage_action_envelopes_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "overage_opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      overage_evidence: {
        Row: {
          created_at: string
          document_ref: string | null
          evidence_type: string
          fingerprint: string | null
          id: string
          metadata: Json
          observed_at: string | null
          opportunity_id: string | null
          source_authority: string | null
          source_url: string | null
          verification_state: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          document_ref?: string | null
          evidence_type: string
          fingerprint?: string | null
          id?: string
          metadata?: Json
          observed_at?: string | null
          opportunity_id?: string | null
          source_authority?: string | null
          source_url?: string | null
          verification_state?: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          document_ref?: string | null
          evidence_type?: string
          fingerprint?: string | null
          id?: string
          metadata?: Json
          observed_at?: string | null
          opportunity_id?: string | null
          source_authority?: string | null
          source_url?: string | null
          verification_state?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "overage_evidence_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "overage_opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      overage_jurisdictions: {
        Row: {
          census_vintage: number | null
          county_code: string | null
          county_fips: string | null
          created_at: string
          geoid: string | null
          is_functioning_government: boolean
          jurisdiction_id: string
          level: string
          name: string
          rule_profile_ref: string
          state_code: string
          state_fips: string | null
          timezone: string | null
          updated_at: string
        }
        Insert: {
          census_vintage?: number | null
          county_code?: string | null
          county_fips?: string | null
          created_at?: string
          geoid?: string | null
          is_functioning_government?: boolean
          jurisdiction_id: string
          level: string
          name: string
          rule_profile_ref: string
          state_code: string
          state_fips?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          census_vintage?: number | null
          county_code?: string | null
          county_fips?: string | null
          created_at?: string
          geoid?: string | null
          is_functioning_government?: boolean
          jurisdiction_id?: string
          level?: string
          name?: string
          rule_profile_ref?: string
          state_code?: string
          state_fips?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      overage_opportunities: {
        Row: {
          blockers: Json
          candidate_name: string | null
          confidence: number | null
          created_at: string
          deadline_at: string | null
          eligibility_state: string
          estimated_amount: number | null
          evidence_complete: boolean
          id: string
          jurisdiction_id: string | null
          opportunity_type: string
          priority_band: string | null
          priority_score: number | null
          property_id: string | null
          provenance_refs: Json
          score_factors: Json
          source_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          blockers?: Json
          candidate_name?: string | null
          confidence?: number | null
          created_at?: string
          deadline_at?: string | null
          eligibility_state?: string
          estimated_amount?: number | null
          evidence_complete?: boolean
          id?: string
          jurisdiction_id?: string | null
          opportunity_type: string
          priority_band?: string | null
          priority_score?: number | null
          property_id?: string | null
          provenance_refs?: Json
          score_factors?: Json
          source_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          blockers?: Json
          candidate_name?: string | null
          confidence?: number | null
          created_at?: string
          deadline_at?: string | null
          eligibility_state?: string
          estimated_amount?: number | null
          evidence_complete?: boolean
          id?: string
          jurisdiction_id?: string | null
          opportunity_type?: string
          priority_band?: string | null
          priority_score?: number | null
          property_id?: string | null
          provenance_refs?: Json
          score_factors?: Json
          source_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      overage_sources: {
        Row: {
          authority_id: string
          authority_role: string
          connector_version: string | null
          created_at: string
          freshness_sla_hours: number | null
          fund_families: string[]
          jurisdiction_id: string
          last_successful_run_at: string | null
          last_verified_at: string | null
          notes: string | null
          source_id: string
          source_type: string
          source_url: string
          state: string
          updated_at: string
        }
        Insert: {
          authority_id: string
          authority_role: string
          connector_version?: string | null
          created_at?: string
          freshness_sla_hours?: number | null
          fund_families?: string[]
          jurisdiction_id: string
          last_successful_run_at?: string | null
          last_verified_at?: string | null
          notes?: string | null
          source_id: string
          source_type: string
          source_url: string
          state: string
          updated_at?: string
        }
        Update: {
          authority_id?: string
          authority_role?: string
          connector_version?: string | null
          created_at?: string
          freshness_sla_hours?: number | null
          fund_families?: string[]
          jurisdiction_id?: string
          last_successful_run_at?: string | null
          last_verified_at?: string | null
          notes?: string | null
          source_id?: string
          source_type?: string
          source_url?: string
          state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "overage_sources_jurisdiction_id_fkey"
            columns: ["jurisdiction_id"]
            isOneToOne: false
            referencedRelation: "overage_jurisdictions"
            referencedColumns: ["jurisdiction_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ack_director_generation_submission: {
        Args: {
          p_lease_token: string
          p_provider_job_id: string
          p_submission_id: string
          p_worker_id: string
        }
        Returns: {
          attempt: number
          created_at: string
          execution_id: string
          id: string
          idempotency_key: string
          last_error: string | null
          lease_expires_at: string | null
          lease_owner: string | null
          lease_token: string | null
          provider_id: string
          provider_job_id: string | null
          request_payload: Json
          status: string
          task_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "director_generation_submission_outbox"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      ack_director_generation_submission_and_save_state: {
        Args: {
          p_execution_error: string
          p_execution_lease_expires_at: string
          p_execution_lease_token: string
          p_execution_status: string
          p_execution_updated_at: string
          p_provider_job_id: string
          p_submission_id: string
          p_submission_lease_token: string
          p_task_error: string
          p_task_status: string
          p_task_updated_at: string
          p_worker_id: string
        }
        Returns: {
          execution: Database["public"]["Tables"]["director_generation_executions"]["Row"]
          submission: Database["public"]["Tables"]["director_generation_submission_outbox"]["Row"]
          task: Database["public"]["Tables"]["director_generation_tasks"]["Row"]
        }[]
      }
      acquire_acquisition_worker_lease: {
        Args: {
          p_holder_id: string
          p_idempotency_key: string
          p_jurisdiction_id: string
          p_lease_token: string
          p_source_id: string
          p_ttl_seconds: number
        }
        Returns: {
          acquired_at: string
          expires_at: string
          fence_token: number
          holder_id: string
          idempotency_key: string
          jurisdiction_id: string
          lease_token: string
          source_id: string
        }
        SetofOptions: {
          from: "*"
          to: "acquisition_worker_leases"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      append_acquisition_checkpoint: {
        Args: {
          p_artifact_sha256?: string
          p_artifact_url?: string
          p_checkpoint_hash: string
          p_idempotency_key: string
          p_jurisdiction_id: string
          p_previous_receipt_hash: string
          p_receipt_hash: string
          p_source_id: string
          p_state: string
          p_surplus_artifact_sha256?: string
          p_surplus_artifact_url?: string
        }
        Returns: {
          artifact_sha256: string | null
          artifact_url: string | null
          checkpoint_hash: string
          created_at: string
          id: number
          idempotency_key: string
          jurisdiction_id: string
          previous_receipt_hash: string | null
          receipt_hash: string
          source_id: string
          state: string
          surplus_artifact_sha256: string | null
          surplus_artifact_url: string | null
        }
        SetofOptions: {
          from: "*"
          to: "acquisition_checkpoints"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      append_jhadina_audit_event: {
        Args: {
          p_actor_id: string
          p_capability: string
          p_decision: string
          p_domain: string
          p_event_id: string
          p_metadata?: Json
          p_occurred_at: string
          p_request_id: string
          p_status: string
        }
        Returns: {
          actor_id: string
          capability: string
          created_at: string
          decision: string
          domain: string
          event_hash: string
          event_id: string
          id: string
          metadata: Json
          occurred_at: string
          previous_hash: string
          request_id: string
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "jhadina_audit_ledger"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      append_jhadina_evolution_run_ledger: {
        Args: {
          p_occurred_at: string
          p_payload: Json
          p_run_id: number
          p_task_id: string
          p_type: string
        }
        Returns: {
          created_at: string
          event_id: string
          hash: string
          id: string
          occurred_at: string
          payload: Json
          previous_hash: string | null
          run_id: number
          sequence: number
          task_id: string
          type: string
        }
        SetofOptions: {
          from: "*"
          to: "jhadina_evolution_run_ledger"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      claim_director_generation_execution: {
        Args: {
          p_lease_ms?: number
          p_provider_id: string
          p_task_id: string
          p_worker_id: string
        }
        Returns: {
          attempt: number
          created_at: string
          error: string | null
          id: string
          lease_expires_at: string | null
          lease_owner: string | null
          lease_token: string | null
          provider_id: string
          provider_job_id: string | null
          status: string
          task_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "director_generation_executions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      claim_director_generation_submission: {
        Args: {
          p_lease_ms: number
          p_submission_id: string
          p_worker_id: string
        }
        Returns: {
          attempt: number
          created_at: string
          execution_id: string
          id: string
          idempotency_key: string
          last_error: string | null
          lease_expires_at: string | null
          lease_owner: string | null
          lease_token: string | null
          provider_id: string
          provider_job_id: string | null
          request_payload: Json
          status: string
          task_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "director_generation_submission_outbox"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      claim_director_generation_task: {
        Args: {
          p_edit_plan_id: string
          p_id: string
          p_idempotency_key: string
          p_now?: string
          p_operation_id: string
          p_project_id: string
          p_request: Json
        }
        Returns: {
          created_at: string
          edit_plan_id: string | null
          error: string | null
          id: string
          idempotency_key: string
          operation_id: string | null
          project_id: string
          request: Json
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "director_generation_tasks"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      claim_money_execution_recovery_lease: {
        Args: {
          p_execution_id: string
          p_lease_id: string
          p_lease_seconds?: number
        }
        Returns: {
          execution_id: string
          lease_expires_at: string
          lease_id: string
          state: string
        }[]
      }
      claim_oce_alert_deliveries: {
        Args: { p_limit?: number; p_now: string; p_worker_id: string }
        Returns: {
          alert_id: string
          attempt: number
          channel: string
          claimed_at: string | null
          claimed_by: string | null
          created_at: string
          dead_lettered_at: string | null
          id: string
          idempotency_key: string
          last_error: string | null
          max_attempts: number
          next_attempt_at: string | null
          payload: Json
          priority: string
          recipient_id: string
          status: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "oce_alert_deliveries"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      commit_acquisition_worker_attempt: {
        Args: {
          p_attempt: number
          p_attempt_hash: string
          p_checkpoint_hash: string
          p_error_code: string
          p_fence_token: number
          p_idempotency_key: string
          p_jurisdiction_id: string
          p_lease_token: string
          p_outcome: string
          p_previous_attempt_hash: string
          p_source_id: string
        }
        Returns: {
          attempt: number
          attempt_hash: string
          checkpoint_hash: string | null
          created_at: string
          error_code: string | null
          fence_token: number
          id: number
          idempotency_key: string
          jurisdiction_id: string
          lease_token: string
          outcome: string
          previous_attempt_hash: string | null
          source_id: string
        }
        SetofOptions: {
          from: "*"
          to: "acquisition_worker_attempts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      commit_jhadina_mining_scan_checkpoint: {
        Args: {
          p_last_scanned_hash: string
          p_last_scanned_height: number
          p_last_successful_scan_at: string
          p_network: string
          p_receiving_address: string
          p_reorg_lookback: number
          p_scanner_version: string
        }
        Returns: {
          checkpoint_id: string
          created_at: string
          last_scanned_hash: string
          last_scanned_height: number
          last_successful_scan_at: string
          network: string
          receiving_address: string
          reorg_lookback: number
          scanner_version: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "jhadina_mining_scan_checkpoints"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      jhadina_ack_research_provider_submission: {
        Args: {
          p_lease_id: string
          p_lease_token: string
          p_provider_job_id?: string
          p_submission_id: string
          p_worker_id: string
        }
        Returns: Json
      }
      jhadina_admit_knowledge_candidate: {
        Args: { p_candidate_id: string }
        Returns: string
      }
      jhadina_admit_research_execution: {
        Args: {
          p_lease_seconds?: number
          p_plan_id: string
          p_policy_decision_id: string
          p_worker_id: string
        }
        Returns: string
      }
      jhadina_adopt_recovery_execution: {
        Args: {
          p_execution_id: string
          p_proposal_hash: string
          p_recovery_lease_id: string
        }
        Returns: boolean
      }
      jhadina_append_shark_market_event: {
        Args: {
          p_chain_id: string
          p_event_id: string
          p_event_type: string
          p_observation_id: string
          p_occurred_at: string
          p_payload: Json
          p_provenance?: Json
          p_received_at: string
          p_source: string
          p_source_ref?: string
          p_subject_id: string
        }
        Returns: {
          inserted: boolean
          sequence: number
        }[]
      }
      jhadina_bind_research_policy_decision: {
        Args: {
          p_action_proposal_id: string
          p_decision_id: string
          p_receipt_id: string
        }
        Returns: boolean
      }
      jhadina_capture_research_evidence: {
        Args: {
          p_authority?: string
          p_content_hash?: string
          p_excerpt?: string
          p_execution_event_id: string
          p_locator?: Json
          p_metadata?: Json
          p_plan_id: string
          p_publisher?: string
          p_source_kind: string
          p_source_uri: string
          p_trust_score?: number
        }
        Returns: string
      }
      jhadina_claim_recovery_attempt: {
        Args: {
          p_actor_id: string
          p_connector_id: string
          p_correlation_id: string
          p_new_execution_id: string
          p_new_idempotency_key: string
          p_operation: string
          p_original_execution_id: string
          p_proposal_hash: string
          p_recovery_lease_id: string
        }
        Returns: boolean
      }
      jhadina_claim_research_execution: {
        Args: {
          p_lease_seconds?: number
          p_plan_id: string
          p_policy_decision_id: string
          p_worker_id: string
        }
        Returns: Json
      }
      jhadina_commit_research_execution_event: {
        Args: {
          p_content_hash?: string
          p_event_type: string
          p_lease_id: string
          p_lease_token: string
          p_payload?: Json
          p_plan_id: string
          p_task_id?: string
          p_usage?: Json
          p_worker_id: string
        }
        Returns: Json
      }
      jhadina_compile_research_plan: {
        Args: {
          p_approval_mode?: string
          p_breadth?: number
          p_budget?: Json
          p_decomposition_id: string
          p_depth?: number
          p_policy_version: string
          p_required_authorities?: Json
          p_required_capabilities?: Json
        }
        Returns: {
          breadth: number
          budget: Json
          content_hash: string | null
          contradiction_checks: Json
          created_at: string
          decomposition_id: string
          depth: number
          evidence_requirements: Json
          id: string
          intent_id: string
          plan_version: number
          policy_requirements: Json
          policy_snapshot: Json
          source_constraints: Json
          status: string
          stopping_criteria: Json
          tasks: Json
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "jhadina_research_plans"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      jhadina_complete_recovery_execution: {
        Args: {
          p_completed_at?: string
          p_execution_id: string
          p_original_execution_id: string
          p_proposal_hash: string
          p_response: Json
        }
        Returns: boolean
      }
      jhadina_create_knowledge_candidate: {
        Args: {
          p_claim: string
          p_confidence: number
          p_evidence_ids: string[]
          p_execution_event_id: string
          p_minimum_authority_score?: number
          p_minimum_sources?: number
          p_object_json: Json
          p_observed_at?: string
          p_plan_id: string
          p_predicate: string
          p_require_fresh?: boolean
          p_subject: string
        }
        Returns: string
      }
      jhadina_create_revalidation_trigger:
        | {
            Args: {
              p_dedupe_key?: string
              p_freshness_state: string
              p_knowledge_record_id: string
              p_max_breadth?: number
              p_max_depth?: number
              p_policy_requirements?: Json
              p_required_authority?: string
              p_research_scope?: Json
              p_trigger_reason: string
              p_triggering_evidence_id?: string
            }
            Returns: {
              created_at: string
              dedupe_key: string
              freshness_state: string
              id: string
              knowledge_record_id: string
              max_breadth: number
              max_depth: number
              policy_requirements: Json
              required_authority: string
              research_intent_id: string | null
              research_scope: Json
              status: string
              trigger_reason: string
              triggering_evidence_id: string | null
              updated_at: string
            }
            SetofOptions: {
              from: "*"
              to: "jhadina_research_revalidation_triggers"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: {
              p_dedupe_key?: string
              p_freshness_state?: string
              p_knowledge_record_id: string
              p_max_breadth?: number
              p_max_depth?: number
              p_policy_requirements?: Json
              p_required_authority?: string
              p_research_scope?: Json
              p_trigger_reason?: string
              p_triggering_evidence_id?: string
            }
            Returns: {
              created_at: string
              dedupe_key: string
              freshness_state: string
              id: string
              knowledge_record_id: string
              max_breadth: number
              max_depth: number
              policy_requirements: Json
              required_authority: string
              research_intent_id: string | null
              research_scope: Json
              status: string
              trigger_reason: string
              triggering_evidence_id: string | null
              updated_at: string
            }
            SetofOptions: {
              from: "*"
              to: "jhadina_research_revalidation_triggers"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      jhadina_evaluate_knowledge_candidate: {
        Args: { p_candidate_id: string }
        Returns: Json
      }
      jhadina_evaluate_research_policy: {
        Args: {
          p_allowed_authorities?: Json
          p_approval_granted?: boolean
          p_available_capabilities?: Json
          p_evaluator_version: string
          p_plan_id: string
          p_policy_version: string
        }
        Returns: {
          action_proposal_id: string | null
          admitted_for_execution: boolean
          approval_mode: string
          audit_receipt_id: string | null
          capability: string | null
          constraints: Json
          created_at: string
          decision: string
          evaluated_at: string
          evaluator_version: string
          id: string
          plan_id: string
          policy_version: string
          reasons: Json
          required_authorities: Json
          required_capabilities: Json
        }
        SetofOptions: {
          from: "*"
          to: "jhadina_research_policy_decisions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      jhadina_evidence_freshness_state: {
        Args: {
          p_captured_at: string
          p_content_changed?: boolean
          p_freshness_sla_hours: number
          p_last_verified_at: string
          p_now?: string
        }
        Returns: string
      }
      jhadina_evolution_run_ledger_append: {
        Args: {
          p_event_id: string
          p_hash: string
          p_occurred_at: string
          p_payload: Json
          p_previous_hash: string
          p_run_id: number
          p_sequence: number
          p_task_id: string
          p_type: string
        }
        Returns: {
          created_at: string
          event_id: string
          hash: string
          id: string
          occurred_at: string
          payload: Json
          previous_hash: string | null
          run_id: number
          sequence: number
          task_id: string
          type: string
        }
        SetofOptions: {
          from: "*"
          to: "jhadina_evolution_run_ledger"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      jhadina_get_research_runtime_plan: {
        Args: { p_plan_id: string }
        Returns: Json
      }
      jhadina_knowledge_freshness_state:
        | {
            Args: {
              p_content_changed: boolean
              p_freshness_sla_hours: number
              p_last_verified_at: string
              p_now: string
              p_observed_at: string
            }
            Returns: string
          }
        | {
            Args: {
              p_content_changed: boolean
              p_freshness_sla_hours: number
              p_last_verified_at: string
              p_now: string
              p_observed_at: string
            }
            Returns: string
          }
      jhadina_mark_research_provider_recovery: {
        Args: {
          p_error: string
          p_lease_id: string
          p_lease_token: string
          p_submission_id: string
          p_worker_id: string
        }
        Returns: boolean
      }
      jhadina_materialize_regret_atomic: {
        Args: { p_record: Json; p_user_id: string }
        Returns: {
          created_at: string
          id: string
          memory_id: string
          provenance: Json
          regret: Json
          salience: number
          superseded_by: string | null
          supersedes: string | null
          tags: Json
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "jhadina_regret_memory"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      jhadina_opportunity_ingest: {
        Args: { p_opportunity: Json; p_triage_state?: string }
        Returns: Json
      }
      jhadina_opportunity_promote_ready: {
        Args: {
          p_case_id: string
          p_opportunity: Json
          p_opportunity_id: string
        }
        Returns: Json
      }
      jhadina_opportunity_promote_recovery_ready_trusted: {
        Args: {
          p_case_id: string
          p_opportunity: Json
          p_opportunity_id: string
          p_user_id: string
        }
        Returns: Json
      }
      jhadina_opportunity_record_outcome: {
        Args: {
          p_learning: Json
          p_opportunity: Json
          p_opportunity_id: string
          p_outcome: Json
        }
        Returns: Json
      }
      jhadina_opportunity_record_trusted_outcome: {
        Args: {
          p_learning: Json
          p_opportunity: Json
          p_opportunity_id: string
          p_outcome: Json
          p_user_id: string
        }
        Returns: Json
      }
      jhadina_opportunity_set_triage: {
        Args: { p_opportunity_id: string; p_triage_state: string }
        Returns: Json
      }
      jhadina_opportunity_start_research: {
        Args: {
          p_case: Json
          p_opportunity: Json
          p_opportunity_id: string
          p_tasks: Json
        }
        Returns: Json
      }
      jhadina_opportunity_update_research_task: {
        Args: {
          p_case_id: string
          p_evidence_refs?: Json
          p_status: string
          p_task_id: string
        }
        Returns: Json
      }
      jhadina_release_research_execution: {
        Args: {
          p_lease_id: string
          p_lease_token: string
          p_state: string
          p_worker_id: string
        }
        Returns: boolean
      }
      jhadina_renew_research_execution_lease: {
        Args: {
          p_lease_id: string
          p_lease_seconds?: number
          p_lease_token: string
          p_worker_id: string
        }
        Returns: Json
      }
      jhadina_research_execution_admissible: {
        Args: { p_decision_id: string }
        Returns: boolean
      }
      jhadina_reserve_research_provider_submission: {
        Args: {
          p_idempotency_key: string
          p_lease_id: string
          p_lease_token: string
          p_plan_id: string
          p_provider_id: string
          p_request_hash: string
          p_task_id: string
          p_worker_id: string
        }
        Returns: Json
      }
      jhadina_save_personality_state: {
        Args: {
          p_expected_version: number
          p_next_state: Json
          p_profile_id: string
        }
        Returns: number
      }
      jhadina_schedule_daily_audit: {
        Args: { p_run_key: string; p_scheduled_for: string }
        Returns: string
      }
      jhadina_set_candidate_contradiction: {
        Args: { p_candidate_id: string; p_state: string }
        Returns: boolean
      }
      jhadina_verify_knowledge_evidence: {
        Args: {
          p_authority_score: number
          p_evidence_id: string
          p_freshness_state: string
          p_last_verified_at?: string
          p_verification_state: string
        }
        Returns: boolean
      }
      process_jhadina_mining_payout: {
        Args: {
          p_block_hash: string
          p_block_height: number
          p_network: string
          p_output_index: number
          p_payout_sats: number
          p_receiving_address: string
          p_scanned_at?: string
          p_txid: string
        }
        Returns: {
          checkpoint_hash: string
          checkpoint_height: number
          processed: boolean
        }[]
      }
      recover_director_generation_submission: {
        Args: {
          p_error: string
          p_lease_token: string
          p_submission_id: string
          p_worker_id: string
        }
        Returns: {
          attempt: number
          created_at: string
          execution_id: string
          id: string
          idempotency_key: string
          last_error: string | null
          lease_expires_at: string | null
          lease_owner: string | null
          lease_token: string | null
          provider_id: string
          provider_job_id: string | null
          request_payload: Json
          status: string
          task_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "director_generation_submission_outbox"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      release_money_execution_recovery_lease: {
        Args: { p_execution_id: string; p_lease_id: string }
        Returns: boolean
      }
      renew_acquisition_worker_lease: {
        Args: {
          p_fence_token: number
          p_jurisdiction_id: string
          p_lease_token: string
          p_source_id: string
          p_ttl_seconds: number
        }
        Returns: {
          acquired_at: string
          expires_at: string
          fence_token: number
          holder_id: string
          idempotency_key: string
          jurisdiction_id: string
          lease_token: string
          source_id: string
        }
        SetofOptions: {
          from: "*"
          to: "acquisition_worker_leases"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      renew_director_generation_execution_lease: {
        Args: {
          p_execution_id: string
          p_lease_ms: number
          p_lease_token: string
          p_worker_id: string
        }
        Returns: {
          attempt: number
          created_at: string
          error: string | null
          id: string
          lease_expires_at: string | null
          lease_owner: string | null
          lease_token: string | null
          provider_id: string
          provider_job_id: string | null
          status: string
          task_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "director_generation_executions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      renew_director_generation_submission_lease: {
        Args: {
          p_lease_ms: number
          p_lease_token: string
          p_submission_id: string
          p_worker_id: string
        }
        Returns: {
          attempt: number
          created_at: string
          execution_id: string
          id: string
          idempotency_key: string
          last_error: string | null
          lease_expires_at: string | null
          lease_owner: string | null
          lease_token: string | null
          provider_id: string
          provider_job_id: string | null
          request_payload: Json
          status: string
          task_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "director_generation_submission_outbox"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      renew_money_execution_recovery_lease: {
        Args: {
          p_execution_id: string
          p_lease_id: string
          p_lease_seconds?: number
        }
        Returns: {
          execution_id: string
          lease_expires_at: string
          lease_id: string
          state: string
        }[]
      }
      reserve_director_generation_submission: {
        Args: {
          p_execution_id: string
          p_idempotency_key: string
          p_lease_owner: string
          p_lease_token: string
          p_provider_id: string
          p_request_payload: Json
          p_task_id: string
        }
        Returns: {
          attempt: number
          created_at: string
          execution_id: string
          id: string
          idempotency_key: string
          last_error: string | null
          lease_expires_at: string | null
          lease_owner: string | null
          lease_token: string | null
          provider_id: string
          provider_job_id: string | null
          request_payload: Json
          status: string
          task_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "director_generation_submission_outbox"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      resolve_money_execution_recovery_atomic: {
        Args: {
          p_attempt_id: string
          p_completed_at: string
          p_error_code: string
          p_error_message: string
          p_lease_id: string
          p_observation: Json
          p_proposal_hash: string
          p_provider_reference: string
          p_reason: string
          p_recovery_required: boolean
          p_state: string
        }
        Returns: boolean
      }
      save_director_generation_state: {
        Args: {
          p_attempt: number
          p_edit_plan_id: string
          p_execution_created_at: string
          p_execution_error: string
          p_execution_id: string
          p_execution_status: string
          p_execution_task_id: string
          p_execution_updated_at: string
          p_idempotency_key: string
          p_lease_expires_at: string
          p_lease_owner: string
          p_lease_token: string
          p_operation_id: string
          p_project_id: string
          p_provider_id: string
          p_provider_job_id: string
          p_request: Json
          p_task_error: string
          p_task_id: string
          p_task_status: string
          p_task_updated_at: string
        }
        Returns: Json
      }
      update_jhadina_agent_run: {
        Args: {
          p_current_step_id: string
          p_expected_version: number
          p_id: string
          p_objective: string
          p_plan_revision: number
          p_policy_decision_id: string
          p_status: string
          p_updated_at: string
        }
        Returns: {
          created_at: string
          current_step_id: string | null
          id: string
          objective: string
          plan_revision: number
          policy_decision_id: string | null
          status: string
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "jhadina_agent_runs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      upsert_media_playback_progress: {
        Args: {
          p_completed: boolean
          p_duration_ms: number
          p_id: string
          p_media_id: string
          p_position_ms: number
          p_provider_id: string
          p_updated_at: string
          p_user_id: string
        }
        Returns: {
          completed: boolean
          duration_ms: number | null
          id: string
          media_id: string
          position_ms: number
          provider_id: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "media_playback_progress"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      verify_jhadina_evolution_run_ledger: {
        Args: { p_run_id: number }
        Returns: boolean
      }
      write_capital_projection_atomic: {
        Args: { p_lot: Json; p_position: Json; p_transaction: Json }
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
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
