export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      meals: {
        Row: {
          id: string
          user_id: string
          name: string
          origin: "user" | "ai"
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          origin?: "user" | "ai"
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          origin?: "user" | "ai"
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      ingredients: {
        Row: {
          id: string
          user_id: string
          name: string
          name_normalized: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          name_normalized?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          name_normalized?: string
        }
        Relationships: []
      }
      meal_ingredients: {
        Row: {
          meal_id: string
          ingredient_id: string
          position: number
        }
        Insert: {
          meal_id: string
          ingredient_id: string
          position?: number
        }
        Update: {
          meal_id?: string
          ingredient_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "meal_ingredients_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_ingredients_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_slots: {
        Row: {
          id: string
          user_id: string
          slot_date: string
          slot_kind: "dejeuner" | "diner"
          meal_id: string | null
        }
        Insert: {
          id?: string
          user_id: string
          slot_date: string
          slot_kind: "dejeuner" | "diner"
          meal_id?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          slot_date?: string
          slot_kind?: "dejeuner" | "diner"
          meal_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plan_slots_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id"]
          },
        ]
      }
      shopping_checks: {
        Row: {
          user_id: string
          week_start: string
          ingredient_id: string
          checked: boolean
        }
        Insert: {
          user_id: string
          week_start: string
          ingredient_id: string
          checked?: boolean
        }
        Update: {
          user_id?: string
          week_start?: string
          ingredient_id?: string
          checked?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "shopping_checks_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      normalize_ingredient_name: {
        Args: { name: string }
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

export type PublicTables = Database["public"]["Tables"]
