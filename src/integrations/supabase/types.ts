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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      admin_user_notes: {
        Row: {
          created_at: string
          created_by: string
          id: string
          note: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          note?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          note?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      bank_accounts: {
        Row: {
          account_holder: string
          account_number: string
          bank_name: string
          branch: string | null
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_holder: string
          account_number: string
          bank_name: string
          branch?: string | null
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_holder?: string
          account_number?: string
          bank_name?: string
          branch?: string | null
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      charity_programs: {
        Row: {
          created_at: string
          current_amount: number
          description: string | null
          end_date: string | null
          id: string
          image_url: string | null
          is_active: boolean
          start_date: string | null
          target_amount: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_amount?: number
          description?: string | null
          end_date?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          start_date?: string | null
          target_amount?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_amount?: number
          description?: string | null
          end_date?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          start_date?: string | null
          target_amount?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      comments: {
        Row: {
          content: string
          created_at: string
          id: string
          news_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          news_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          news_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_news_id_fkey"
            columns: ["news_id"]
            isOneToOne: false
            referencedRelation: "news"
            referencedColumns: ["id"]
          },
        ]
      }
      deposit_settings: {
        Row: {
          config: Json
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          method_type: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          method_type: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          method_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      hero_banners: {
        Row: {
          created_at: string
          display_order: number
          id: string
          image_url: string
          is_active: boolean
          link_url: string | null
          subtitle: string | null
          title: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          image_url: string
          is_active?: boolean
          link_url?: string | null
          subtitle?: string | null
          title: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string
          is_active?: boolean
          link_url?: string | null
          subtitle?: string | null
          title?: string
        }
        Relationships: []
      }
      identity_verifications: {
        Row: {
          address: string
          back_image_url: string
          created_at: string
          date_of_birth: string
          document_number: string
          document_type: string
          expiry_date: string
          front_image_url: string
          full_name: string
          id: string
          rejection_reason: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address: string
          back_image_url: string
          created_at?: string
          date_of_birth: string
          document_number: string
          document_type: string
          expiry_date: string
          front_image_url: string
          full_name: string
          id?: string
          rejection_reason?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string
          back_image_url?: string
          created_at?: string
          date_of_birth?: string
          document_number?: string
          document_type?: string
          expiry_date?: string
          front_image_url?: string
          full_name?: string
          id?: string
          rejection_reason?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      live_chat_messages: {
        Row: {
          attachment_name: string | null
          attachment_type: string | null
          attachment_url: string | null
          created_at: string | null
          id: string
          is_read: boolean | null
          message: string
          read_at: string | null
          room_id: string
          sender_id: string | null
          sender_name: string
          sender_type: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          read_at?: string | null
          room_id: string
          sender_id?: string | null
          sender_name: string
          sender_type: string
        }
        Update: {
          attachment_name?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          read_at?: string | null
          room_id?: string
          sender_id?: string | null
          sender_name?: string
          sender_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_chat_messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "live_chat_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      live_chat_notes: {
        Row: {
          author_email: string | null
          author_id: string | null
          author_name: string
          content: string
          created_at: string | null
          id: string
          room_id: string
          updated_at: string | null
        }
        Insert: {
          author_email?: string | null
          author_id?: string | null
          author_name: string
          content: string
          created_at?: string | null
          id?: string
          room_id: string
          updated_at?: string | null
        }
        Update: {
          author_email?: string | null
          author_id?: string | null
          author_name?: string
          content?: string
          created_at?: string | null
          id?: string
          room_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "live_chat_notes_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "live_chat_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      live_chat_rooms: {
        Row: {
          assigned_to: string | null
          created_at: string | null
          customer_email: string | null
          customer_id: string
          customer_name: string
          id: string
          last_message: string | null
          last_updated_at: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string | null
          customer_email?: string | null
          customer_id: string
          customer_name: string
          id?: string
          last_message?: string | null
          last_updated_at?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          created_at?: string | null
          customer_email?: string | null
          customer_id?: string
          customer_name?: string
          id?: string
          last_message?: string | null
          last_updated_at?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      live_chat_typing: {
        Row: {
          id: string
          is_typing: boolean | null
          room_id: string
          typing_preview: string | null
          updated_at: string | null
          user_id: string
          user_name: string
          user_type: string
        }
        Insert: {
          id?: string
          is_typing?: boolean | null
          room_id: string
          typing_preview?: string | null
          updated_at?: string | null
          user_id: string
          user_name: string
          user_type: string
        }
        Update: {
          id?: string
          is_typing?: boolean | null
          room_id?: string
          typing_preview?: string | null
          updated_at?: string | null
          user_id?: string
          user_name?: string
          user_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_chat_typing_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "live_chat_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      news: {
        Row: {
          author_id: string | null
          category: Database["public"]["Enums"]["news_category"]
          content: string
          created_at: string
          id: string
          image_url: string | null
          is_featured: boolean
          summary: string | null
          title: string
          updated_at: string
          views: number
        }
        Insert: {
          author_id?: string | null
          category?: Database["public"]["Enums"]["news_category"]
          content: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_featured?: boolean
          summary?: string | null
          title: string
          updated_at?: string
          views?: number
        }
        Update: {
          author_id?: string | null
          category?: Database["public"]["Enums"]["news_category"]
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_featured?: boolean
          summary?: string | null
          title?: string
          updated_at?: string
          views?: number
        }
        Relationships: []
      }
      option_trades: {
        Row: {
          admin_result: string | null
          amount: number
          created_at: string
          direction: string
          duration_seconds: number
          entry_price: number
          exit_price: number | null
          expires_at: string | null
          fee_rate: number
          id: string
          loss_rate: number | null
          product_id: string
          profit_loss: number | null
          profit_rate: number
          settled_at: string | null
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_result?: string | null
          amount: number
          created_at?: string
          direction: string
          duration_seconds: number
          entry_price: number
          exit_price?: number | null
          expires_at?: string | null
          fee_rate?: number
          id?: string
          loss_rate?: number | null
          product_id: string
          profit_loss?: number | null
          profit_rate?: number
          settled_at?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_result?: string | null
          amount?: number
          created_at?: string
          direction?: string
          duration_seconds?: number
          entry_price?: number
          exit_price?: number | null
          expires_at?: string | null
          fee_rate?: number
          id?: string
          loss_rate?: number | null
          product_id?: string
          profit_loss?: number | null
          profit_rate?: number
          settled_at?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "option_trades_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      price_history: {
        Row: {
          close_price: number
          created_at: string
          high_price: number
          id: string
          low_price: number
          open_price: number
          product_id: string
          recorded_at: string
          volume: number | null
        }
        Insert: {
          close_price: number
          created_at?: string
          high_price: number
          id?: string
          low_price: number
          open_price: number
          product_id: string
          recorded_at?: string
          volume?: number | null
        }
        Update: {
          close_price?: number
          created_at?: string
          high_price?: number
          id?: string
          low_price?: number
          open_price?: number
          product_id?: string
          recorded_at?: string
          volume?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "price_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_price_controls: {
        Row: {
          created_at: string
          direction: string
          expires_at: string | null
          is_active: boolean
          product_id: string
          strength: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          direction?: string
          expires_at?: string | null
          is_active?: boolean
          product_id: string
          strength?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          direction?: string
          expires_at?: string | null
          is_active?: boolean
          product_id?: string
          strength?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_price_controls_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          high_24h: number | null
          id: string
          image_url: string | null
          low_24h: number | null
          name: string
          price: number | null
          price_change: number | null
          status: Database["public"]["Enums"]["product_status"]
          symbol: string | null
          turnover: string | null
          updated_at: string
          volume: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          high_24h?: number | null
          id?: string
          image_url?: string | null
          low_24h?: number | null
          name: string
          price?: number | null
          price_change?: number | null
          status?: Database["public"]["Enums"]["product_status"]
          symbol?: string | null
          turnover?: string | null
          updated_at?: string
          volume?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          high_24h?: number | null
          id?: string
          image_url?: string | null
          low_24h?: number | null
          name?: string
          price?: number | null
          price_change?: number | null
          status?: Database["public"]["Enums"]["product_status"]
          symbol?: string | null
          turnover?: string | null
          updated_at?: string
          volume?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          balance: number | null
          created_at: string
          department: string | null
          email: string | null
          frozen_reason: string | null
          full_name: string | null
          id: string
          is_frozen: boolean | null
          is_trade_frozen: boolean | null
          last_login_at: string | null
          last_login_ip: string | null
          phone: string | null
          position: string | null
          total_income: number | null
          updated_at: string
          user_code: number | null
          withdrawal_password_hash: string | null
        }
        Insert: {
          avatar_url?: string | null
          balance?: number | null
          created_at?: string
          department?: string | null
          email?: string | null
          frozen_reason?: string | null
          full_name?: string | null
          id: string
          is_frozen?: boolean | null
          is_trade_frozen?: boolean | null
          last_login_at?: string | null
          last_login_ip?: string | null
          phone?: string | null
          position?: string | null
          total_income?: number | null
          updated_at?: string
          user_code?: number | null
          withdrawal_password_hash?: string | null
        }
        Update: {
          avatar_url?: string | null
          balance?: number | null
          created_at?: string
          department?: string | null
          email?: string | null
          frozen_reason?: string | null
          full_name?: string | null
          id?: string
          is_frozen?: boolean | null
          is_trade_frozen?: boolean | null
          last_login_at?: string | null
          last_login_ip?: string | null
          phone?: string | null
          position?: string | null
          total_income?: number | null
          updated_at?: string
          user_code?: number | null
          withdrawal_password_hash?: string | null
        }
        Relationships: []
      }
      quick_reply_templates: {
        Row: {
          created_at: string | null
          created_by: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          tag: string
          text: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          tag: string
          text: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          tag?: string
          text?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          action_type: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          action_type: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          action_type?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          network: string | null
          notes: string | null
          status: string
          tx_hash: string | null
          type: string
          updated_at: string
          user_id: string
          wallet_address: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          network?: string | null
          notes?: string | null
          status?: string
          tx_hash?: string | null
          type: string
          updated_at?: string
          user_id: string
          wallet_address?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          network?: string | null
          notes?: string | null
          status?: string
          tx_hash?: string | null
          type?: string
          updated_at?: string
          user_id?: string
          wallet_address?: string | null
        }
        Relationships: []
      }
      user_notifications: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string
          is_read: boolean | null
          message: string
          metadata: Json | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          metadata?: Json | null
          read_at?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          metadata?: Json | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      profiles_safe: {
        Row: {
          avatar_url: string | null
          balance: number | null
          created_at: string | null
          department: string | null
          email: string | null
          frozen_reason: string | null
          full_name: string | null
          id: string | null
          is_frozen: boolean | null
          is_trade_frozen: boolean | null
          last_login_at: string | null
          phone: string | null
          position: string | null
          total_income: number | null
          updated_at: string | null
          user_code: number | null
        }
        Insert: {
          avatar_url?: string | null
          balance?: number | null
          created_at?: string | null
          department?: string | null
          email?: string | null
          frozen_reason?: string | null
          full_name?: string | null
          id?: string | null
          is_frozen?: boolean | null
          is_trade_frozen?: boolean | null
          last_login_at?: string | null
          phone?: string | null
          position?: string | null
          total_income?: number | null
          updated_at?: string | null
          user_code?: number | null
        }
        Update: {
          avatar_url?: string | null
          balance?: number | null
          created_at?: string | null
          department?: string | null
          email?: string | null
          frozen_reason?: string | null
          full_name?: string | null
          id?: string | null
          is_frozen?: boolean | null
          is_trade_frozen?: boolean | null
          last_login_at?: string | null
          phone?: string | null
          position?: string | null
          total_income?: number | null
          updated_at?: string | null
          user_code?: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_add_balance: {
        Args: { _admin_id: string; _amount: number; _user_id: string }
        Returns: Json
      }
      admin_approve_deposit: {
        Args: { _admin_id: string; _notes?: string; _transaction_id: string }
        Returns: Json
      }
      admin_approve_withdrawal: {
        Args: { _admin_id: string; _notes?: string; _transaction_id: string }
        Returns: Json
      }
      admin_reject_transaction: {
        Args: { _admin_id: string; _notes?: string; _transaction_id: string }
        Returns: Json
      }
      admin_subtract_balance: {
        Args: { _admin_id: string; _amount: number; _user_id: string }
        Returns: Json
      }
      check_rate_limit: {
        Args: {
          _action_type: string
          _max_requests: number
          _user_id: string
          _window_seconds: number
        }
        Returns: boolean
      }
      cleanup_expired_notifications: { Args: never; Returns: undefined }
      cleanup_old_rate_limits: { Args: never; Returns: undefined }
      create_withdrawal_request: {
        Args: {
          _amount: number
          _network: string
          _user_id: string
          _wallet_address: string
        }
        Returns: Json
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_withdrawal_password: { Args: { _user_id: string }; Returns: boolean }
      is_valid_wallet_address: {
        Args: { _address: string; _network: string }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      process_option_trade:
        | {
            Args: {
              _amount: number
              _direction: string
              _duration_seconds: number
              _fee_rate: number
              _product_id: string
              _profit_rate: number
              _user_id: string
            }
            Returns: Json
          }
        | {
            Args: {
              _amount: number
              _direction: string
              _duration_seconds: number
              _fee_rate: number
              _loss_rate?: number
              _product_id: string
              _profit_rate: number
              _user_id: string
            }
            Returns: Json
          }
      process_trade: {
        Args: {
          _amount: number
          _product_id: string
          _trade_type: string
          _user_id: string
        }
        Returns: Json
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      run_live_price_sync_loop: { Args: never; Returns: undefined }
      settle_option_trade: {
        Args: { _exit_price: number; _trade_id: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "user"
      news_category:
        | "company"
        | "product"
        | "event"
        | "announcement"
        | "charity"
      product_status: "available" | "sold" | "pending"
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
      app_role: ["admin", "user"],
      news_category: ["company", "product", "event", "announcement", "charity"],
      product_status: ["available", "sold", "pending"],
    },
  },
} as const
