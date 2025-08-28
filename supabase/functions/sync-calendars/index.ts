import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GoogleCalendar {
  id: string
  summary: string
  description?: string
  primary?: boolean
}

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : ''
  console.log(`[SYNC-CALENDARS] ${step}${detailsStr}`)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    logStep("Function started")

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header provided')
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token)
    
    if (userError) {
      throw new Error(`Authentication error: ${userError.message}`)
    }

    const user = userData.user
    if (!user) {
      throw new Error('User not authenticated')
    }

    logStep("User authenticated", { userId: user.id })

    // Get the user's Google access token from the session
    const session = await supabaseClient.auth.getSession()
    const providerToken = session.data.session?.provider_token

    if (!providerToken) {
      throw new Error('No Google access token found. Please reconnect your Google account.')
    }

    logStep("Provider token found")

    // Fetch calendars from Google Calendar API
    const calendarResponse = await fetch(
      'https://www.googleapis.com/calendar/v3/users/me/calendarList',
      {
        headers: {
          'Authorization': `Bearer ${providerToken}`,
          'Accept': 'application/json',
        },
      }
    )

    if (!calendarResponse.ok) {
      const errorText = await calendarResponse.text()
      logStep("Google API error", { status: calendarResponse.status, error: errorText })
      throw new Error(`Google Calendar API error: ${calendarResponse.status} - ${errorText}`)
    }

    const calendarData = await calendarResponse.json()
    const calendars: GoogleCalendar[] = calendarData.items || []

    logStep("Fetched calendars from Google", { count: calendars.length })

    // Clear existing calendars for this user
    const { error: deleteError } = await supabaseClient
      .from('user_calendars')
      .delete()
      .eq('user_id', user.id)

    if (deleteError) {
      logStep("Error deleting existing calendars", { error: deleteError })
    }

    // Insert new calendars
    const calendarInserts = calendars.map(calendar => ({
      user_id: user.id,
      calendar_id: calendar.id,
      calendar_name: calendar.summary,
      calendar_description: calendar.description || null,
      is_primary: calendar.primary || false,
    }))

    if (calendarInserts.length > 0) {
      const { error: insertError } = await supabaseClient
        .from('user_calendars')
        .insert(calendarInserts)

      if (insertError) {
        throw new Error(`Error inserting calendars: ${insertError.message}`)
      }
    }

    logStep("Calendars synced successfully", { count: calendarInserts.length })

    // Update user settings with the access token
    const { error: settingsError } = await supabaseClient
      .from('user_settings')
      .upsert({
        user_id: user.id,
        google_access_token: providerToken,
      }, { onConflict: 'user_id' })

    if (settingsError) {
      logStep("Error updating user settings", { error: settingsError })
    }

    return new Response(
      JSON.stringify({
        success: true,
        calendars: calendarInserts,
        message: `Successfully synced ${calendarInserts.length} calendars`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error: any) {
    logStep("ERROR in sync-calendars", { message: error.message })
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})