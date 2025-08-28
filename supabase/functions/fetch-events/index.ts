import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GoogleEvent {
  id: string
  summary: string
  description?: string
  start: {
    dateTime?: string
    date?: string
  }
  end: {
    dateTime?: string
    date?: string
  }
  location?: string
  htmlLink?: string
  hangoutLink?: string
}

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : ''
  console.log(`[FETCH-EVENTS] ${step}${detailsStr}`)
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

    // Get user settings
    const { data: settings, error: settingsError } = await supabaseClient
      .from('user_settings')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (settingsError || !settings) {
      throw new Error('User settings not found. Please complete setup first.')
    }

    if (!settings.service_enabled) {
      throw new Error('Calert service is not enabled')
    }

    if (!settings.selected_calendar_id) {
      throw new Error('No calendar selected')
    }

    if (!settings.google_access_token) {
      throw new Error('No Google access token found. Please reconnect your Google account.')
    }

    logStep("User settings loaded", { 
      calendarId: settings.selected_calendar_id,
      serviceEnabled: settings.service_enabled 
    })

    // Calculate time range - get events for the next 24 hours
    const now = new Date()
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)

    const timeMin = now.toISOString()
    const timeMax = tomorrow.toISOString()

    // Fetch events from Google Calendar API
    const eventsUrl = new URL(`https://www.googleapis.com/calendar/v3/calendars/${settings.selected_calendar_id}/events`)
    eventsUrl.searchParams.set('timeMin', timeMin)
    eventsUrl.searchParams.set('timeMax', timeMax)
    eventsUrl.searchParams.set('singleEvents', 'true')
    eventsUrl.searchParams.set('orderBy', 'startTime')
    eventsUrl.searchParams.set('maxResults', '50')

    const eventsResponse = await fetch(eventsUrl.toString(), {
      headers: {
        'Authorization': `Bearer ${settings.google_access_token}`,
        'Accept': 'application/json',
      },
    })

    if (!eventsResponse.ok) {
      const errorText = await eventsResponse.text()
      logStep("Google API error", { status: eventsResponse.status, error: errorText })
      
      if (eventsResponse.status === 401) {
        throw new Error('Google access token expired. Please reconnect your Google account.')
      }
      
      throw new Error(`Google Calendar API error: ${eventsResponse.status} - ${errorText}`)
    }

    const eventsData = await eventsResponse.json()
    const events: GoogleEvent[] = eventsData.items || []

    logStep("Fetched events from Google", { count: events.length })

    // Filter out all-day events and format the response
    const filteredEvents = events
      .filter(event => {
        // Skip all-day events (they have 'date' instead of 'dateTime')
        return event.start.dateTime && event.end.dateTime
      })
      .map(event => ({
        id: event.id,
        title: event.summary || 'Untitled Event',
        description: event.description || '',
        startTime: event.start.dateTime,
        endTime: event.end.dateTime,
        location: event.location || '',
        meetingLink: event.hangoutLink || event.htmlLink || '',
      }))

    logStep("Filtered and formatted events", { count: filteredEvents.length })

    // Find the next upcoming event
    const nextEvent = filteredEvents.find(event => {
      const eventStart = new Date(event.startTime)
      return eventStart > now
    })

    return new Response(
      JSON.stringify({
        success: true,
        events: filteredEvents,
        nextEvent: nextEvent || null,
        totalCount: filteredEvents.length,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error: any) {
    logStep("ERROR in fetch-events", { message: error.message })
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