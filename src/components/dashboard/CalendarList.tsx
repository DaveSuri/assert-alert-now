import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, Check } from 'lucide-react'

interface CalendarItem {
  id: string
  summary: string
  description?: string
  primary?: boolean
}

interface CalendarListProps {
  calendars: CalendarItem[]
  selectedCalendarId: string | null
  onSelectCalendar: (calendarId: string) => void
  disabled?: boolean
}

export const CalendarList = ({ 
  calendars, 
  selectedCalendarId, 
  onSelectCalendar, 
  disabled 
}: CalendarListProps) => {
  if (calendars.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            No calendars found. Try syncing your calendars first.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {calendars.map((calendar) => (
        <Card 
          key={calendar.id}
          className={`cursor-pointer transition-colors hover:bg-accent ${
            selectedCalendarId === calendar.id ? 'border-primary bg-primary/5' : ''
          }`}
          onClick={() => !disabled && onSelectCalendar(calendar.id)}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <h3 className="font-medium">{calendar.summary}</h3>
                  {calendar.primary && (
                    <Badge variant="secondary">Primary</Badge>
                  )}
                  {selectedCalendarId === calendar.id && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </div>
                {calendar.description && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {calendar.description}
                  </p>
                )}
              </div>
              <Button
                variant={selectedCalendarId === calendar.id ? "default" : "outline"}
                size="sm"
                disabled={disabled}
                onClick={(e) => {
                  e.stopPropagation()
                  onSelectCalendar(calendar.id)
                }}
              >
                {selectedCalendarId === calendar.id ? 'Selected' : 'Select'}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}