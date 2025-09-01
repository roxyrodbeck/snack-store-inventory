import { createClient } from "@supabase/supabase-js"

// Check if environment variables are available
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Create a lazy-initialized client
let supabaseClient: any = null
let isInitialized = false

// Mock client for demo mode
const createMockClient = () => ({
  from: (table: string) => ({
    select: (columns?: string) => ({
      order: (column: string, options?: any) => Promise.resolve({ data: [], error: null }),
      single: () => Promise.resolve({ data: null, error: { code: "PGRST116", message: "No rows found" } }),
      eq: (column: string, value: any) => Promise.resolve({ data: null, error: null }),
      then: (callback: any) => callback({ data: [], error: null }),
    }),
    insert: (data: any) => Promise.resolve({ data: null, error: null }),
    update: (data: any) => ({
      eq: (column: string, value: any) => Promise.resolve({ data: null, error: null }),
    }),
    delete: () => ({
      eq: (column: string, value: any) => Promise.resolve({ data: null, error: null }),
      neq: (column: string, value: any) => Promise.resolve({ data: null, error: null }),
    }),
  }),
  channel: (name: string) => ({
    on: (event: string, config: any, callback?: any) => ({
      subscribe: () => {},
    }),
    subscribe: () => {},
  }),
  removeChannel: (channel: any) => {},
})

// Initialize client only when needed
const getSupabaseClient = () => {
  if (!isInitialized) {
    if (supabaseUrl && supabaseAnonKey) {
      try {
        supabaseClient = createClient(supabaseUrl, supabaseAnonKey)
        console.log("Supabase client initialized successfully")
      } catch (error) {
        console.error("Failed to initialize Supabase client:", error)
        supabaseClient = createMockClient()
        console.warn("Using mock client due to Supabase initialization error")
      }
    } else {
      console.warn("Supabase environment variables not found. Using mock client for demo mode.")
      supabaseClient = createMockClient()
    }
    isInitialized = true
  }
  return supabaseClient
}

// Export a proxy object that lazily initializes the client
export const supabase = new Proxy({} as any, {
  get(target, prop) {
    const client = getSupabaseClient()
    return client[prop]
  },
})

// Helper function to check if we're in demo mode
export const isDemoMode = () => !supabaseUrl || !supabaseAnonKey

export type Database = {
  public: {
    Tables: {
      products: {
        Row: {
          id: string
          name: string
          price: number
          unit_cost: number
          quantity: number
          category: string
          time_restriction_start?: string
          time_restriction_end?: string
          second_time_restriction_start?: string
          second_time_restriction_end?: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          price: number
          unit_cost?: number
          quantity: number
          category?: string
          time_restriction_start?: string
          time_restriction_end?: string
          second_time_restriction_start?: string
          second_time_restriction_end?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          price?: number
          unit_cost?: number
          quantity?: number
          category?: string
          time_restriction_start?: string
          time_restriction_end?: string
          second_time_restriction_start?: string
          second_time_restriction_end?: string
          updated_at?: string
        }
      }
      sales: {
        Row: {
          id: string
          employee_id: string
          items: any
          total: number
          payment_method: "cash" | "school-cash"
          created_at: string
        }
        Insert: {
          id?: string
          employee_id: string
          items: any
          total: number
          payment_method: "cash" | "school-cash"
          created_at?: string
        }
        Update: {
          id?: string
          employee_id?: string
          items?: any
          total?: number
          payment_method?: "cash" | "school-cash"
        }
      }
      cash_register: {
        Row: {
          id: string
          current_amount: number
          starting_amount: number
          updated_at: string
          updated_by: string
        }
        Insert: {
          id?: string
          current_amount: number
          starting_amount?: number
          updated_at?: string
          updated_by: string
        }
        Update: {
          current_amount?: number
          starting_amount?: number
          updated_at?: string
          updated_by?: string
        }
      }
    }
  }
}
