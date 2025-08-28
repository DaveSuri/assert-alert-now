import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { CalendarHeader } from './CalendarHeader'
import { CalendarList } from './CalendarList'
import { CalertTabDemo } from '../demo/CalertTabDemo'
import { useToast } from '@/components/ui/use-toast'
import { Loader2, Settings, Calendar, Bell, Eye } from 'lucide-react'

interface UserSettings {
  selected_calendar_id: string | null
  service_enabled: boolean
  google_access_token: string | null
}

interface CalendarItem {
  id: string
  summary: string
  description?: string
  primary?: boolean
}

export const Dashboard = () => {
  const { user, signOut } = useAuth()
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [calendars, setCalendars] = useState<CalendarItem[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [showDemo, setShowDemo] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (user) {
      loadUserData()
    }
  }, [user])

  const loadUserData = async () => {
    if (!user) return

    try {
      // Load user settings
      const { data: settingsData, error: settingsError } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (settingsError && settingsError.code !== 'PGRST116') {
        throw settingsError
      }

      setSettings(settingsData || {
        selected_calendar_id: null,
        service_enabled: false,
        google_access_token: null
      })

      // Load user calendars
      const { data: calendarsData, error: calendarsError } = await supabase
        .from('user_calendars')
        .select('*')
        .eq('user_id', user.id)

      if (calendarsError) {
        throw calendarsError
      }

      const calendarItems = calendarsData.map(cal => ({
        id: cal.calendar_id,
        summary: cal.calendar_name,
        description: cal.calendar_description,
        primary: cal.is_primary
      }))

      setCalendars(calendarItems)
    } catch (error: any) {
      console.error('Error loading user data:', error)
      toast({
        title: "Error loading data",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const connectGoogleCalendar = async () => {
    setUpdating(true)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          scopes: 'https://www.googleapis.com/auth/calendar.readonly',
          redirectTo: `${window.location.origin}/`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      })

      if (error) throw error
    } catch (error: any) {
      toast({
        title: "Failed to connect Google Calendar",
        description: error.message,
        variant: "destructive",
      })
      setUpdating(false)
    }
  }

  const syncCalendars = async () => {
    setUpdating(true)
    try {
      const { data, error } = await supabase.functions.invoke('sync-calendars')
      
      if (error) throw error

      toast({
        title: "Calendars synced successfully",
        description: `Found ${data.calendars.length} calendars`,
      })

      // Reload data
      await loadUserData()
    } catch (error: any) {
      toast({
        title: "Failed to sync calendars",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setUpdating(false)
    }
  }

  const updateCalendarSelection = async (calendarId: string) => {
    if (!user) return

    setUpdating(true)
    try {
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          selected_calendar_id: calendarId,
          service_enabled: settings?.service_enabled || false,
        }, { onConflict: 'user_id' })

      if (error) throw error

      setSettings(prev => prev ? { ...prev, selected_calendar_id: calendarId } : null)
      
      toast({
        title: "Calendar selection updated",
        description: "Your preferred calendar has been saved.",
      })
    } catch (error: any) {
      toast({
        title: "Failed to update selection",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setUpdating(false)
    }
  }

  const toggleService = async (enabled: boolean) => {
    if (!user) return

    setUpdating(true)
    try {
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          selected_calendar_id: settings?.selected_calendar_id,
          service_enabled: enabled,
        }, { onConflict: 'user_id' })

      if (error) throw error

      setSettings(prev => prev ? { ...prev, service_enabled: enabled } : null)
      
      toast({
        title: enabled ? "Calert enabled" : "Calert disabled",
        description: enabled 
          ? "You'll now receive assertive calendar alerts." 
          : "Calendar alerts have been disabled.",
      })
    } catch (error: any) {
      toast({
        title: "Failed to update service",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setUpdating(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (showDemo) {
    return <CalertTabDemo onClose={() => setShowDemo(false)} />
  }

  const hasGoogleConnection = settings?.google_access_token !== null
  const hasCalendars = calendars.length > 0
  const canEnableService = hasGoogleConnection && hasCalendars && settings?.selected_calendar_id

  return (
    <div className="min-h-screen bg-background">
      <CalendarHeader user={user} onSignOut={signOut} />
      
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-6">
          {/* Welcome Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Calendar className="mr-2 h-5 w-5" />
                Welcome to Calert
              </CardTitle>
              <CardDescription>
                Set up your assertive calendar alerts to never miss another meeting.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => setShowDemo(true)} 
                variant="outline"
                className="w-full"
              >
                <Eye className="mr-2 h-4 w-4" />
                See How Calert Tab Works
              </Button>
            </CardContent>
          </Card>

          {/* Google Calendar Connection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Settings className="mr-2 h-5 w-5" />
                Google Calendar Connection
              </CardTitle>
              <CardDescription>
                Connect your Google Calendar to start receiving alerts.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!hasGoogleConnection ? (
                <Button 
                  onClick={connectGoogleCalendar} 
                  disabled={updating}
                  size="lg"
                >
                  {updating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Connect Google Calendar
                </Button>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center space-x-2 text-green-600">
                    <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                    <span>Google Calendar connected</span>
                  </div>
                  <Button 
                    variant="outline" 
                    onClick={syncCalendars} 
                    disabled={updating}
                  >
                    {updating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Sync Calendars
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Calendar Selection */}
          {hasGoogleConnection && (
            <Card>
              <CardHeader>
                <CardTitle>Select Calendar</CardTitle>
                <CardDescription>
                  Choose which calendar to monitor for alerts.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CalendarList
                  calendars={calendars}
                  selectedCalendarId={settings?.selected_calendar_id}
                  onSelectCalendar={updateCalendarSelection}
                  disabled={updating}
                />
              </CardContent>
            </Card>
          )}

          {/* Service Toggle */}
          {canEnableService && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Bell className="mr-2 h-5 w-5" />
                  Calert Service
                </CardTitle>
                <CardDescription>
                  Enable or disable assertive calendar alerts.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="service-toggle"
                    checked={settings?.service_enabled || false}
                    onCheckedChange={toggleService}
                    disabled={updating}
                  />
                  <Label htmlFor="service-toggle">
                    {settings?.service_enabled ? 'Alerts Enabled' : 'Alerts Disabled'}
                  </Label>
                </div>
                {settings?.service_enabled && (
                  <p className="text-sm text-muted-foreground mt-2">
                    You'll receive full-screen alerts when your events start.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Status Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Setup Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <span>Google Calendar Connected</span>
                <div className={`w-2 h-2 rounded-full ${hasGoogleConnection ? 'bg-green-500' : 'bg-red-500'}`}></div>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span>Calendars Synced</span>
                <div className={`w-2 h-2 rounded-full ${hasCalendars ? 'bg-green-500' : 'bg-red-500'}`}></div>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span>Calendar Selected</span>
                <div className={`w-2 h-2 rounded-full ${settings?.selected_calendar_id ? 'bg-green-500' : 'bg-red-500'}`}></div>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span>Service Active</span>
                <div className={`w-2 h-2 rounded-full ${settings?.service_enabled ? 'bg-green-500' : 'bg-red-500'}`}></div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}