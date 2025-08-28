import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, Clock, MapPin, Video, X } from 'lucide-react'

interface CalertTabDemoProps {
  onClose: () => void
}

export const CalertTabDemo = ({ onClose }: CalertTabDemoProps) => {
  const [isFullscreen, setIsFullscreen] = useState(false)

  const demoEvent = {
    title: "Product Strategy Meeting",
    time: "2:00 PM - 3:00 PM",
    location: "Conference Room A",
    meetingLink: "https://meet.google.com/demo-link",
    description: "Quarterly product planning and roadmap review with the engineering team."
  }

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      document.documentElement.requestFullscreen?.()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen?.()
      setIsFullscreen(false)
    }
  }

  return (
    <div className={`${isFullscreen ? 'fixed inset-0 z-50 bg-background' : 'relative'} flex items-center justify-center p-4`}>
      <Card className="w-full max-w-2xl mx-auto shadow-2xl border-2 border-primary">
        <CardHeader className="text-center pb-6">
          <div className="flex items-center justify-between mb-4">
            <Badge variant="destructive" className="animate-pulse">
              LIVE ALERT
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <CardTitle className="text-3xl font-bold text-primary mb-2">
            Your Meeting is Starting Now!
          </CardTitle>
          <CardDescription className="text-lg">
            This is what a Calert Tab looks like when your event begins
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-semibold mb-2">{demoEvent.title}</h2>
            <div className="flex items-center justify-center text-muted-foreground mb-4">
              <Clock className="h-4 w-4 mr-2" />
              {demoEvent.time}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center">
              <MapPin className="h-4 w-4 mr-3 text-muted-foreground" />
              <span>{demoEvent.location}</span>
            </div>
            
            <div className="flex items-start">
              <Calendar className="h-4 w-4 mr-3 text-muted-foreground mt-1" />
              <span>{demoEvent.description}</span>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button className="flex-1" size="lg">
              <Video className="mr-2 h-4 w-4" />
              Join Meeting
            </Button>
            <Button 
              variant="outline" 
              size="lg"
              onClick={onClose}
            >
              Dismiss
            </Button>
          </div>

          <div className="text-center pt-2">
            <Button
              variant="ghost"
              onClick={toggleFullscreen}
              className="text-sm text-muted-foreground"
            >
              {isFullscreen ? 'Exit' : 'Try'} Fullscreen Mode
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}