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
      families: {
        Row: {
          id: string
          name: string
          invite_code: string
          owner_id: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          invite_code?: string
          owner_id: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          invite_code?: string
          owner_id?: string
          created_at?: string
        }
        Relationships: []
      }
      family_members: {
        Row: {
          family_id: string
          user_id: string
          role: "admin" | "member"
          display_name: string
          joined_at: string
        }
        Insert: {
          family_id: string
          user_id: string
          role?: "admin" | "member"
          display_name?: string
          joined_at?: string
        }
        Update: {
          family_id?: string
          user_id?: string
          role?: "admin" | "member"
          display_name?: string
          joined_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_members_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
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
      effective_owner_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      my_family_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      is_family_owner: {
        Args: { fid: string }
        Returns: boolean
      }
      create_family: {
        Args: { family_name: string; member_name?: string }
        Returns: {
          id: string
          name: string
          invite_code: string
          owner_id: string
          created_at: string
        }
      }
      join_family: {
        Args: { invite: string; member_name?: string }
        Returns: {
          id: string
          name: string
          invite_code: string
          owner_id: string
          created_at: string
        }
      }
      get_my_family: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      leave_family: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      delete_family: {
        Args: Record<PropertyKey, never>
        Returns: undefined
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

/* ---------- families ---------- */

export type FamilyRow = PublicTables["families"]["Row"]
export type FamilyMemberRow = PublicTables["family_members"]["Row"]
