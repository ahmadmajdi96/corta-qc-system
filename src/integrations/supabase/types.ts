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
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: number
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: number
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_user_profile_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      calibration_records: {
        Row: {
          certificate_ref: string | null
          created_at: string
          gage_id: string
          id: string
          next_due: string | null
          notes: string | null
          performed_at: string
          performed_by: string | null
          result: Database["public"]["Enums"]["calibration_result"]
        }
        Insert: {
          certificate_ref?: string | null
          created_at?: string
          gage_id: string
          id?: string
          next_due?: string | null
          notes?: string | null
          performed_at?: string
          performed_by?: string | null
          result: Database["public"]["Enums"]["calibration_result"]
        }
        Update: {
          certificate_ref?: string | null
          created_at?: string
          gage_id?: string
          id?: string
          next_due?: string | null
          notes?: string | null
          performed_at?: string
          performed_by?: string | null
          result?: Database["public"]["Enums"]["calibration_result"]
        }
        Relationships: [
          {
            foreignKeyName: "calibration_records_gage_id_fkey"
            columns: ["gage_id"]
            isOneToOne: false
            referencedRelation: "gages"
            referencedColumns: ["id"]
          },
        ]
      }
      capa_records: {
        Row: {
          capa_number: string | null
          created_at: string
          created_by: string | null
          d1_team: string | null
          d2_problem: string | null
          d3_containment: string | null
          d4_root_cause: string | null
          d5_corrective: string | null
          d6_implement: string | null
          d7_prevent: string | null
          d8_recognition: string | null
          due_date: string | null
          effectiveness_verified_at: string | null
          effectiveness_verified_by: string | null
          id: string
          methodology: Database["public"]["Enums"]["capa_methodology"]
          nc_id: string | null
          owner_id: string | null
          status: Database["public"]["Enums"]["capa_status"]
          updated_at: string
        }
        Insert: {
          capa_number?: string | null
          created_at?: string
          created_by?: string | null
          d1_team?: string | null
          d2_problem?: string | null
          d3_containment?: string | null
          d4_root_cause?: string | null
          d5_corrective?: string | null
          d6_implement?: string | null
          d7_prevent?: string | null
          d8_recognition?: string | null
          due_date?: string | null
          effectiveness_verified_at?: string | null
          effectiveness_verified_by?: string | null
          id?: string
          methodology?: Database["public"]["Enums"]["capa_methodology"]
          nc_id?: string | null
          owner_id?: string | null
          status?: Database["public"]["Enums"]["capa_status"]
          updated_at?: string
        }
        Update: {
          capa_number?: string | null
          created_at?: string
          created_by?: string | null
          d1_team?: string | null
          d2_problem?: string | null
          d3_containment?: string | null
          d4_root_cause?: string | null
          d5_corrective?: string | null
          d6_implement?: string | null
          d7_prevent?: string | null
          d8_recognition?: string | null
          due_date?: string | null
          effectiveness_verified_at?: string | null
          effectiveness_verified_by?: string | null
          id?: string
          methodology?: Database["public"]["Enums"]["capa_methodology"]
          nc_id?: string | null
          owner_id?: string | null
          status?: Database["public"]["Enums"]["capa_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "capa_records_nc_id_fkey"
            columns: ["nc_id"]
            isOneToOne: false
            referencedRelation: "non_conformances"
            referencedColumns: ["id"]
          },
        ]
      }
      corrective_actions: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          description: string
          due_date: string | null
          id: string
          non_conformance_id: string
          status: string
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          description: string
          due_date?: string | null
          id?: string
          non_conformance_id: string
          status?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string
          due_date?: string | null
          id?: string
          non_conformance_id?: string
          status?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "corrective_actions_assigned_to_profile_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corrective_actions_non_conformance_id_fkey"
            columns: ["non_conformance_id"]
            isOneToOne: false
            referencedRelation: "non_conformances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corrective_actions_verified_by_profile_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      export_jobs: {
        Row: {
          created_at: string
          export_type: string
          filters: Json | null
          format: string
          id: string
          row_count: number | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          export_type: string
          filters?: Json | null
          format: string
          id?: string
          row_count?: number | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          export_type?: string
          filters?: Json | null
          format?: string
          id?: string
          row_count?: number | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      gages: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          gage_type: string | null
          id: string
          last_cal_date: string | null
          location: string | null
          manufacturer: string | null
          name: string
          next_cal_date: string | null
          notes: string | null
          resolution: number | null
          serial_number: string | null
          status: Database["public"]["Enums"]["gage_status"]
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          gage_type?: string | null
          id?: string
          last_cal_date?: string | null
          location?: string | null
          manufacturer?: string | null
          name: string
          next_cal_date?: string | null
          notes?: string | null
          resolution?: number | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["gage_status"]
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          gage_type?: string | null
          id?: string
          last_cal_date?: string | null
          location?: string | null
          manufacturer?: string | null
          name?: string
          next_cal_date?: string | null
          notes?: string | null
          resolution?: number | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["gage_status"]
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gages_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "measurement_units"
            referencedColumns: ["id"]
          },
        ]
      }
      incoming_lots: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          lot_number: string
          notes: string | null
          po_number: string | null
          product_id: string | null
          received_at: string
          received_qty: number
          status: Database["public"]["Enums"]["incoming_lot_status"]
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          lot_number: string
          notes?: string | null
          po_number?: string | null
          product_id?: string | null
          received_at?: string
          received_qty?: number
          status?: Database["public"]["Enums"]["incoming_lot_status"]
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          lot_number?: string
          notes?: string | null
          po_number?: string | null
          product_id?: string | null
          received_at?: string
          received_qty?: number
          status?: Database["public"]["Enums"]["incoming_lot_status"]
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incoming_lots_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incoming_lots_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_measurements: {
        Row: {
          attachment_url: string | null
          gage_id: string | null
          id: string
          inspection_id: string
          is_na: boolean
          is_pass: boolean | null
          measured_value: string | null
          notes: string | null
          recorded_at: string
          recorded_by: string
          spec_item_id: string
        }
        Insert: {
          attachment_url?: string | null
          gage_id?: string | null
          id?: string
          inspection_id: string
          is_na?: boolean
          is_pass?: boolean | null
          measured_value?: string | null
          notes?: string | null
          recorded_at?: string
          recorded_by: string
          spec_item_id: string
        }
        Update: {
          attachment_url?: string | null
          gage_id?: string | null
          id?: string
          inspection_id?: string
          is_na?: boolean
          is_pass?: boolean | null
          measured_value?: string | null
          notes?: string | null
          recorded_at?: string
          recorded_by?: string
          spec_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspection_measurements_gage_id_fkey"
            columns: ["gage_id"]
            isOneToOne: false
            referencedRelation: "gages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_measurements_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_measurements_recorded_by_profile_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_measurements_spec_item_id_fkey"
            columns: ["spec_item_id"]
            isOneToOne: false
            referencedRelation: "specification_items"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_plans: {
        Row: {
          aql_level: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          plan_type: Database["public"]["Enums"]["plan_type"]
          product_id: string | null
          sample_size_rule: string | null
          standard_reference: string | null
          updated_at: string
        }
        Insert: {
          aql_level?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          plan_type: Database["public"]["Enums"]["plan_type"]
          product_id?: string | null
          sample_size_rule?: string | null
          standard_reference?: string | null
          updated_at?: string
        }
        Update: {
          aql_level?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          plan_type?: Database["public"]["Enums"]["plan_type"]
          product_id?: string | null
          sample_size_rule?: string | null
          standard_reference?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspection_plans_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_schedules: {
        Row: {
          assigned_to: string | null
          created_at: string
          custom_cron: string | null
          end_date: string | null
          frequency: string
          id: string
          is_active: boolean
          product_id: string
          shift_pattern: string | null
          spec_id: string
          start_date: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          custom_cron?: string | null
          end_date?: string | null
          frequency: string
          id?: string
          is_active?: boolean
          product_id: string
          shift_pattern?: string | null
          spec_id: string
          start_date: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          custom_cron?: string | null
          end_date?: string | null
          frequency?: string
          id?: string
          is_active?: boolean
          product_id?: string
          shift_pattern?: string | null
          spec_id?: string
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspection_schedules_assigned_to_profile_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_schedules_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_schedules_spec_id_fkey"
            columns: ["spec_id"]
            isOneToOne: false
            referencedRelation: "quality_specifications"
            referencedColumns: ["id"]
          },
        ]
      }
      inspections: {
        Row: {
          cancel_reason: string | null
          completed_at: string | null
          created_at: string
          hold_id: string | null
          id: string
          incoming_lot_id: string | null
          inspection_method: string | null
          inspection_stage: string | null
          line_id: string | null
          lot_number: string | null
          notes: string | null
          operator_id: string | null
          performed_by: string | null
          plan_id: string | null
          plan_type: Database["public"]["Enums"]["plan_type"] | null
          product_id: string
          schedule_id: string | null
          scheduled_date: string
          spec_id: string
          started_at: string | null
          station_id: string | null
          status: string
          updated_at: string
          work_order_id: string | null
        }
        Insert: {
          cancel_reason?: string | null
          completed_at?: string | null
          created_at?: string
          hold_id?: string | null
          id?: string
          incoming_lot_id?: string | null
          inspection_method?: string | null
          inspection_stage?: string | null
          line_id?: string | null
          lot_number?: string | null
          notes?: string | null
          operator_id?: string | null
          performed_by?: string | null
          plan_id?: string | null
          plan_type?: Database["public"]["Enums"]["plan_type"] | null
          product_id: string
          schedule_id?: string | null
          scheduled_date: string
          spec_id: string
          started_at?: string | null
          station_id?: string | null
          status?: string
          updated_at?: string
          work_order_id?: string | null
        }
        Update: {
          cancel_reason?: string | null
          completed_at?: string | null
          created_at?: string
          hold_id?: string | null
          id?: string
          incoming_lot_id?: string | null
          inspection_method?: string | null
          inspection_stage?: string | null
          line_id?: string | null
          lot_number?: string | null
          notes?: string | null
          operator_id?: string | null
          performed_by?: string | null
          plan_id?: string | null
          plan_type?: Database["public"]["Enums"]["plan_type"] | null
          product_id?: string
          schedule_id?: string | null
          scheduled_date?: string
          spec_id?: string
          started_at?: string | null
          station_id?: string | null
          status?: string
          updated_at?: string
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inspections_hold_id_fkey"
            columns: ["hold_id"]
            isOneToOne: false
            referencedRelation: "quality_holds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_incoming_lot_id_fkey"
            columns: ["incoming_lot_id"]
            isOneToOne: false
            referencedRelation: "incoming_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "production_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_performed_by_profile_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "inspection_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "inspection_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_spec_id_fkey"
            columns: ["spec_id"]
            isOneToOne: false
            referencedRelation: "quality_specifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      measurement_units: {
        Row: {
          code: string
          created_at: string
          id: string
          label: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          label: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          label?: string
        }
        Relationships: []
      }
      msa_studies: {
        Row: {
          created_at: string
          gage_id: string
          id: string
          notes: string | null
          performed_at: string
          performed_by: string | null
          result: Json | null
          study_type: Database["public"]["Enums"]["msa_study_type"]
          verdict: Database["public"]["Enums"]["msa_verdict"] | null
        }
        Insert: {
          created_at?: string
          gage_id: string
          id?: string
          notes?: string | null
          performed_at?: string
          performed_by?: string | null
          result?: Json | null
          study_type: Database["public"]["Enums"]["msa_study_type"]
          verdict?: Database["public"]["Enums"]["msa_verdict"] | null
        }
        Update: {
          created_at?: string
          gage_id?: string
          id?: string
          notes?: string | null
          performed_at?: string
          performed_by?: string | null
          result?: Json | null
          study_type?: Database["public"]["Enums"]["msa_study_type"]
          verdict?: Database["public"]["Enums"]["msa_verdict"] | null
        }
        Relationships: [
          {
            foreignKeyName: "msa_studies_gage_id_fkey"
            columns: ["gage_id"]
            isOneToOne: false
            referencedRelation: "gages"
            referencedColumns: ["id"]
          },
        ]
      }
      non_conformances: {
        Row: {
          capa_id: string | null
          category: string | null
          closed_at: string | null
          containment: string | null
          description: string
          disposition: string | null
          hold_id: string | null
          id: string
          inspection_id: string | null
          measurement_id: string | null
          number: string
          raised_at: string
          raised_by: string
          rejection_reason: string | null
          root_cause: string | null
          root_cause_category: string | null
          severity: string
          status: string
          updated_at: string
          work_order_id: string | null
        }
        Insert: {
          capa_id?: string | null
          category?: string | null
          closed_at?: string | null
          containment?: string | null
          description: string
          disposition?: string | null
          hold_id?: string | null
          id?: string
          inspection_id?: string | null
          measurement_id?: string | null
          number: string
          raised_at?: string
          raised_by: string
          rejection_reason?: string | null
          root_cause?: string | null
          root_cause_category?: string | null
          severity: string
          status?: string
          updated_at?: string
          work_order_id?: string | null
        }
        Update: {
          capa_id?: string | null
          category?: string | null
          closed_at?: string | null
          containment?: string | null
          description?: string
          disposition?: string | null
          hold_id?: string | null
          id?: string
          inspection_id?: string | null
          measurement_id?: string | null
          number?: string
          raised_at?: string
          raised_by?: string
          rejection_reason?: string | null
          root_cause?: string | null
          root_cause_category?: string | null
          severity?: string
          status?: string
          updated_at?: string
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "non_conformances_capa_id_fkey"
            columns: ["capa_id"]
            isOneToOne: false
            referencedRelation: "capa_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "non_conformances_hold_id_fkey"
            columns: ["hold_id"]
            isOneToOne: false
            referencedRelation: "quality_holds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "non_conformances_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "non_conformances_measurement_id_fkey"
            columns: ["measurement_id"]
            isOneToOne: false
            referencedRelation: "inspection_measurements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "non_conformances_raised_by_profile_fkey"
            columns: ["raised_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "non_conformances_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          action: string
          id: string
          resource: string
        }
        Insert: {
          action: string
          id?: string
          resource: string
        }
        Update: {
          action?: string
          id?: string
          resource?: string
        }
        Relationships: []
      }
      plan_characteristics: {
        Row: {
          acceptance_criteria: string | null
          activity: string | null
          check_points: string | null
          comments: string | null
          created_at: string
          id: string
          inspected_by: string | null
          inspection_method: string | null
          is_critical: boolean
          plan_id: string
          point_type: string | null
          procedure: string | null
          sample_frequency: string | null
          sequence: number
          spec_item_id: string | null
          updated_at: string
          verifying_doc: string | null
        }
        Insert: {
          acceptance_criteria?: string | null
          activity?: string | null
          check_points?: string | null
          comments?: string | null
          created_at?: string
          id?: string
          inspected_by?: string | null
          inspection_method?: string | null
          is_critical?: boolean
          plan_id: string
          point_type?: string | null
          procedure?: string | null
          sample_frequency?: string | null
          sequence?: number
          spec_item_id?: string | null
          updated_at?: string
          verifying_doc?: string | null
        }
        Update: {
          acceptance_criteria?: string | null
          activity?: string | null
          check_points?: string | null
          comments?: string | null
          created_at?: string
          id?: string
          inspected_by?: string | null
          inspection_method?: string | null
          is_critical?: boolean
          plan_id?: string
          point_type?: string | null
          procedure?: string | null
          sample_frequency?: string | null
          sequence?: number
          spec_item_id?: string | null
          updated_at?: string
          verifying_doc?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plan_characteristics_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "inspection_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_characteristics_spec_item_id_fkey"
            columns: ["spec_item_id"]
            isOneToOne: false
            referencedRelation: "specification_items"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          id: string
          name: string
          parent_id: string | null
        }
        Insert: {
          id?: string
          name: string
          parent_id?: string | null
        }
        Update: {
          id?: string
          name?: string
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      product_routings: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          product_id: string
          sequence: number
          station_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          product_id: string
          sequence: number
          station_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          product_id?: string
          sequence?: number
          station_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_routings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_routings_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      production_lines: {
        Row: {
          area: string | null
          code: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          area?: string | null
          code?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          area?: string | null
          code?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          sku: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          sku: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sku?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          last_login_at: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string
          id: string
          is_active?: boolean
          last_login_at?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      quality_holds: {
        Row: {
          created_at: string
          created_by: string | null
          disposition: Database["public"]["Enums"]["disposition"] | null
          hold_number: string | null
          id: string
          lot_number: string | null
          notes: string | null
          product_id: string | null
          reason: string
          resolved_at: string | null
          resolved_by: string | null
          severity_id: string | null
          status: Database["public"]["Enums"]["hold_status"]
          updated_at: string
          work_order_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          disposition?: Database["public"]["Enums"]["disposition"] | null
          hold_number?: string | null
          id?: string
          lot_number?: string | null
          notes?: string | null
          product_id?: string | null
          reason: string
          resolved_at?: string | null
          resolved_by?: string | null
          severity_id?: string | null
          status?: Database["public"]["Enums"]["hold_status"]
          updated_at?: string
          work_order_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          disposition?: Database["public"]["Enums"]["disposition"] | null
          hold_number?: string | null
          id?: string
          lot_number?: string | null
          notes?: string | null
          product_id?: string | null
          reason?: string
          resolved_at?: string | null
          resolved_by?: string | null
          severity_id?: string | null
          status?: Database["public"]["Enums"]["hold_status"]
          updated_at?: string
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quality_holds_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_holds_severity_id_fkey"
            columns: ["severity_id"]
            isOneToOne: false
            referencedRelation: "severities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_holds_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_specifications: {
        Row: {
          created_at: string
          created_by: string
          effective_date: string | null
          id: string
          is_active: boolean
          product_id: string
          version: number
        }
        Insert: {
          created_at?: string
          created_by: string
          effective_date?: string | null
          id?: string
          is_active?: boolean
          product_id: string
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          effective_date?: string | null
          id?: string
          is_active?: boolean
          product_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "quality_specifications_created_by_profile_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_specifications_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      request_events: {
        Row: {
          actor_id: string | null
          created_at: string
          event_type: string
          from_status: Database["public"]["Enums"]["request_status"] | null
          id: string
          notes: string | null
          request_id: string
          to_status: Database["public"]["Enums"]["request_status"] | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event_type: string
          from_status?: Database["public"]["Enums"]["request_status"] | null
          id?: string
          notes?: string | null
          request_id: string
          to_status?: Database["public"]["Enums"]["request_status"] | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event_type?: string
          from_status?: Database["public"]["Enums"]["request_status"] | null
          id?: string
          notes?: string | null
          request_id?: string
          to_status?: Database["public"]["Enums"]["request_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "request_events_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      requests: {
        Row: {
          assignee_id: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_notes: string | null
          description: string | null
          id: string
          kind: Database["public"]["Enums"]["request_kind"]
          number: string
          payload: Json
          requester_id: string
          result_plan_id: string | null
          result_product_id: string | null
          status: Database["public"]["Enums"]["request_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_notes?: string | null
          description?: string | null
          id?: string
          kind: Database["public"]["Enums"]["request_kind"]
          number: string
          payload?: Json
          requester_id: string
          result_plan_id?: string | null
          result_product_id?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_notes?: string | null
          description?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["request_kind"]
          number?: string
          payload?: Json
          requester_id?: string
          result_plan_id?: string | null
          result_product_id?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "requests_result_plan_id_fkey"
            columns: ["result_plan_id"]
            isOneToOne: false
            referencedRelation: "inspection_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_result_product_id_fkey"
            columns: ["result_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          permission_id: string
          role_id: string
        }
        Insert: {
          permission_id: string
          role_id: string
        }
        Update: {
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          description: string | null
          id: string
          name: string
        }
        Insert: {
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      severities: {
        Row: {
          code: string
          color: string
          id: string
          label: string
          sort_order: number
        }
        Insert: {
          code: string
          color?: string
          id?: string
          label: string
          sort_order?: number
        }
        Update: {
          code?: string
          color?: string
          id?: string
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      spc_samples: {
        Row: {
          cp: number | null
          cpk: number | null
          created_at: string
          created_by: string | null
          id: string
          lcl: number | null
          out_of_control_rules: Json | null
          product_id: string | null
          r_value: number | null
          sample_time: string
          sigma: number | null
          spec_item_id: string | null
          station_id: string | null
          subgroup_id: string | null
          subgroup_size: number | null
          ucl: number | null
          values: Json | null
          work_order_id: string | null
          x_bar: number | null
        }
        Insert: {
          cp?: number | null
          cpk?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          lcl?: number | null
          out_of_control_rules?: Json | null
          product_id?: string | null
          r_value?: number | null
          sample_time?: string
          sigma?: number | null
          spec_item_id?: string | null
          station_id?: string | null
          subgroup_id?: string | null
          subgroup_size?: number | null
          ucl?: number | null
          values?: Json | null
          work_order_id?: string | null
          x_bar?: number | null
        }
        Update: {
          cp?: number | null
          cpk?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          lcl?: number | null
          out_of_control_rules?: Json | null
          product_id?: string | null
          r_value?: number | null
          sample_time?: string
          sigma?: number | null
          spec_item_id?: string | null
          station_id?: string | null
          subgroup_id?: string | null
          subgroup_size?: number | null
          ucl?: number | null
          values?: Json | null
          work_order_id?: string | null
          x_bar?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "spc_samples_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spc_samples_spec_item_id_fkey"
            columns: ["spec_item_id"]
            isOneToOne: false
            referencedRelation: "specification_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spc_samples_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spc_samples_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      specification_items: {
        Row: {
          id: string
          is_critical: boolean
          lower_tolerance: number | null
          measurement_type: string
          name: string
          pass_criteria: string | null
          sequence: number
          spec_id: string
          target_value: number | null
          unit: string | null
          upper_tolerance: number | null
        }
        Insert: {
          id?: string
          is_critical?: boolean
          lower_tolerance?: number | null
          measurement_type: string
          name: string
          pass_criteria?: string | null
          sequence?: number
          spec_id: string
          target_value?: number | null
          unit?: string | null
          upper_tolerance?: number | null
        }
        Update: {
          id?: string
          is_critical?: boolean
          lower_tolerance?: number | null
          measurement_type?: string
          name?: string
          pass_criteria?: string | null
          sequence?: number
          spec_id?: string
          target_value?: number | null
          unit?: string | null
          upper_tolerance?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "specification_items_spec_id_fkey"
            columns: ["spec_id"]
            isOneToOne: false
            referencedRelation: "quality_specifications"
            referencedColumns: ["id"]
          },
        ]
      }
      stations: {
        Row: {
          code: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          line_id: string | null
          name: string
          sequence: number | null
          station_type: string | null
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          line_id?: string | null
          name: string
          sequence?: number | null
          station_type?: string | null
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          line_id?: string | null
          name?: string
          sequence?: number | null
          station_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stations_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "production_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          code: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          rating: number | null
          updated_at: string
        }
        Insert: {
          code?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          rating?: number | null
          updated_at?: string
        }
        Update: {
          code?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          rating?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          role_id: string
          user_id: string
        }
        Insert: {
          role_id: string
          user_id: string
        }
        Update: {
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      wo_operations: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          sequence: number
          started_at: string | null
          station_id: string | null
          status: Database["public"]["Enums"]["wo_operation_status"]
          updated_at: string
          work_order_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          sequence?: number
          started_at?: string | null
          station_id?: string | null
          status?: Database["public"]["Enums"]["wo_operation_status"]
          updated_at?: string
          work_order_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          sequence?: number
          started_at?: string | null
          station_id?: string | null
          status?: Database["public"]["Enums"]["wo_operation_status"]
          updated_at?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wo_operations_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wo_operations_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_orders: {
        Row: {
          actual_end: string | null
          actual_start: string | null
          created_at: string
          created_by: string | null
          id: string
          line_id: string | null
          lot_number: string | null
          notes: string | null
          number: string
          planned_end: string | null
          planned_start: string | null
          product_id: string | null
          quantity_planned: number
          quantity_produced: number
          status: Database["public"]["Enums"]["work_order_status"]
          updated_at: string
        }
        Insert: {
          actual_end?: string | null
          actual_start?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          line_id?: string | null
          lot_number?: string | null
          notes?: string | null
          number: string
          planned_end?: string | null
          planned_start?: string | null
          product_id?: string | null
          quantity_planned?: number
          quantity_produced?: number
          status?: Database["public"]["Enums"]["work_order_status"]
          updated_at?: string
        }
        Update: {
          actual_end?: string | null
          actual_start?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          line_id?: string | null
          lot_number?: string | null
          notes?: string | null
          number?: string
          planned_end?: string | null
          planned_start?: string | null
          product_id?: string | null
          quantity_planned?: number
          quantity_produced?: number
          status?: Database["public"]["Enums"]["work_order_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_orders_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "production_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_any_role: {
        Args: { _role_names: string[]; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: { _role_name: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      calibration_result: "pass" | "fail" | "conditional"
      capa_methodology: "8d" | "5why" | "fishbone"
      capa_status:
        | "draft"
        | "in_progress"
        | "verification"
        | "closed"
        | "cancelled"
      disposition: "use_as_is" | "rework" | "scrap" | "return_to_supplier"
      gage_status: "active" | "due" | "overdue" | "out_of_service"
      hold_status: "open" | "under_review" | "released" | "scrapped" | "rework"
      incoming_lot_status:
        | "received"
        | "sampling"
        | "accepted"
        | "rejected"
        | "partial"
      msa_study_type: "gage_rr" | "linearity" | "bias" | "stability"
      msa_verdict: "acceptable" | "marginal" | "unacceptable"
      plan_type: "incoming" | "in_process" | "final"
      request_kind: "new_product"
      request_status:
        | "pending"
        | "in_review"
        | "approved"
        | "rejected"
        | "completed"
        | "cancelled"
      wo_operation_status:
        | "pending"
        | "in_progress"
        | "completed"
        | "skipped"
        | "failed"
      work_order_status:
        | "planned"
        | "released"
        | "in_progress"
        | "completed"
        | "closed"
        | "on_hold"
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
    Enums: {
      calibration_result: ["pass", "fail", "conditional"],
      capa_methodology: ["8d", "5why", "fishbone"],
      capa_status: [
        "draft",
        "in_progress",
        "verification",
        "closed",
        "cancelled",
      ],
      disposition: ["use_as_is", "rework", "scrap", "return_to_supplier"],
      gage_status: ["active", "due", "overdue", "out_of_service"],
      hold_status: ["open", "under_review", "released", "scrapped", "rework"],
      incoming_lot_status: [
        "received",
        "sampling",
        "accepted",
        "rejected",
        "partial",
      ],
      msa_study_type: ["gage_rr", "linearity", "bias", "stability"],
      msa_verdict: ["acceptable", "marginal", "unacceptable"],
      plan_type: ["incoming", "in_process", "final"],
      request_kind: ["new_product"],
      request_status: [
        "pending",
        "in_review",
        "approved",
        "rejected",
        "completed",
        "cancelled",
      ],
      wo_operation_status: [
        "pending",
        "in_progress",
        "completed",
        "skipped",
        "failed",
      ],
      work_order_status: [
        "planned",
        "released",
        "in_progress",
        "completed",
        "closed",
        "on_hold",
      ],
    },
  },
} as const
