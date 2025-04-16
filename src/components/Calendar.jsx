import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import EventCard from '../components/EventCard.jsx';
import axios from 'axios';
import dayjs from 'dayjs';
import '../styles/Calendar.css';  

// These are the colors defined in the CSS
const AVAILABLE_COLORS = ['blue', 'green', 'purple', 'orange'];

const Calendar = ({ initialDate = new Date(), onEventClick }) => {
  const [currentDate, setCurrentDate] = useState(initialDate);
  const [currentView, setCurrentView] = useState('month');
  const [viewDropdownOpen, setViewDropdownOpen] = useState(false);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Get month name and year
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  const monthName = monthNames[currentDate.getMonth()];
  const year = currentDate.getFullYear();

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Handle event clicks
  const handleEventClick = (event) => {
    if (onEventClick) {
      onEventClick(event);
    }
  };

  // Handle day clicks
  const handleDayClick = (date) => {
    setCurrentDate(date);
    setCurrentView('day');
  };

  // Get relevant time window
  const getRelevantTimeWindow = (events, currentTime) => {
    const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
    
    // Get upcoming events
    const upcomingEvents = events.filter(event => {
      const endTime = new Date(event.end);
      const endMinutes = endTime.getHours() * 60 + endTime.getMinutes();
      return endMinutes > currentMinutes;
    });

    if (upcomingEvents.length === 0) {
      // If no upcoming events, show window around current time
      return {
        startMinutes: Math.floor(currentMinutes / 30) * 30 - 30, // Round to previous half hour
        endMinutes: Math.ceil(currentMinutes / 30) * 30 + 90    // Show next 1.5 hours
      };
    }

    // Find the earliest and latest times from upcoming events
    const eventTimes = upcomingEvents.flatMap(event => [
      new Date(event.start).getHours() * 60 + new Date(event.start).getMinutes(),
      new Date(event.end).getHours() * 60 + new Date(event.end).getMinutes()
    ]);

    const earliestEventTime = Math.min(...eventTimes);
    const latestEventTime = Math.max(...eventTimes);

    // Create a window that includes current time and upcoming events
    const startMinutes = Math.min(currentMinutes, earliestEventTime) - 30;
    const endMinutes = Math.max(currentMinutes + 60, latestEventTime + 30);

    // Ensure minimum 2-hour window
    if (endMinutes - startMinutes < 120) {
      return {
        startMinutes: startMinutes,
        endMinutes: startMinutes + 120
      };
    }

    return { startMinutes, endMinutes };
  };

  // Get time slots
  const getTimeSlots = (startMinutes, endMinutes) => {
    const slots = [];
    const totalMinutes = endMinutes - startMinutes;
    const slotCount = 6; // We want 6 time slots
    const interval = Math.ceil(totalMinutes / (slotCount - 1));

    for (let i = 0; i < slotCount; i++) {
      const minutes = startMinutes + (i * interval);
      const hour = Math.floor(minutes / 60) % 24;
      const minute = minutes % 60;
      slots.push({
        minutes,
        label: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
      });
    }

    return slots;
  };

  // Find overlapping events
  const findOverlappingEvents = (events) => {
    // Sort events by start time and then by title for consistent ordering
    const sortedEvents = [...events].sort((a, b) => {
      const timeCompare = new Date(a.start) - new Date(b.start);
      if (timeCompare === 0) {
        return a.title.localeCompare(b.title);
      }
      return timeCompare;
    });
    
    // Group overlapping events
    const groups = [];
    let currentGroup = [];
    
    sortedEvents.forEach((event) => {
      const eventStart = new Date(event.start);
      const eventEnd = new Date(event.end);
      
      const overlapsWithGroup = currentGroup.some(groupEvent => {
        const groupStart = new Date(groupEvent.start);
        const groupEnd = new Date(groupEvent.end);
        return (eventStart.getTime() === groupStart.getTime() && 
                eventEnd.getTime() === groupEnd.getTime());
      });
      
      if (overlapsWithGroup) {
        currentGroup.push(event);
      } else {
        if (currentGroup.length > 0) {
          groups.push([...currentGroup]);
        }
        currentGroup = [event];
      }
    });
    
    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }
    
    // Calculate position info for each event
    const eventPositions = new Map();
    groups.forEach(group => {
      const groupSize = group.length;
      group.forEach((event, index) => {
        eventPositions.set(event.id, {
          width: '200px', // Fixed width for all events
          left: `${index * 210}px`, // Add some gap between events
          groupSize,
          groupIndex: index,
          totalInGroup: groupSize
        });
      });
    });
    
    return eventPositions;
  };

  // Format current time
  const formatCurrentTime = (date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  // Fetch meetings from backend
  const fetchMeetings = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:5000/api/meetings/get-user-meetings', {
        headers: {
          Authorization: `Bearer ${token}`,
        }
      });

      if (response.data.success) {
        let formattedMeetings = [];
        
        // First sort meetings by start time to process them sequentially
        const sortedMeetings = [...response.data.meetings].sort((a, b) => 
          new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
        );
        
        // Color cycling logic - use a global index to track used colors
        let colorIndex = 0;
        
        // Process each meeting
        sortedMeetings.forEach(meeting => {
          // Assign next color in the cycle
          const color = AVAILABLE_COLORS[colorIndex % AVAILABLE_COLORS.length];
          
          // Move to next color for the next meeting
          colorIndex++;
          
          const formattedMeeting = {
            id: meeting.id,
            type: `Info: ${meeting.role}`,
            title: meeting.meeting_name,
            start: meeting.start_time,
            end: meeting.end_time,
            date: dayjs(meeting.start_time).format("dddd, D MMMM, YYYY"),
            duration: dayjs(meeting.end_time).diff(dayjs(meeting.start_time), 'minute') + " min",
            location: "Venue ID: " + meeting.venue_id,
            description: meeting.meeting_description || "No description available",
            host: `${meeting.created_by}`,
            priority: meeting.priority.toLowerCase(),
            deadline: meeting.meeting_status === "not_started" ? "Upcoming" : null,
            progress: meeting.meeting_status === "in_progress" ? "40%" : null,
            repeat_type: meeting.repeat_type.toUpperCase(),
            members: meeting.members,
            points: meeting.points,
            host_id: meeting.created_by_id,
            color: color // Assign color from the cycle
          };
          
          formattedMeetings.push(formattedMeeting);
        });

        setEvents(formattedMeetings);
        console.log("Meetings with colors:", formattedMeetings);
      }
    } catch (error) {
      console.error("Failed to fetch meetings:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMeetings();
  }, []);

  // Navigation functions
  const goToPrevious = () => {
    if (currentView === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    } else if (currentView === 'week') {
      const newDate = new Date(currentDate);
      newDate.setDate(newDate.getDate() - 7);
      setCurrentDate(newDate);
    } else if (currentView === 'day') {
      const newDate = new Date(currentDate);
      newDate.setDate(newDate.getDate() - 1);
      setCurrentDate(newDate);
    } else if (currentView === 'year') {
      setCurrentDate(new Date(currentDate.getFullYear() - 1, 0, 1));
    }
  };
  
  const goToNext = () => {
    if (currentView === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    } else if (currentView === 'week') {
      const newDate = new Date(currentDate);
      newDate.setDate(newDate.getDate() + 7);
      setCurrentDate(newDate);
    } else if (currentView === 'day') {
      const newDate = new Date(currentDate);
      newDate.setDate(newDate.getDate() + 1);
      setCurrentDate(newDate);
    } else if (currentView === 'year') {
      setCurrentDate(new Date(currentDate.getFullYear() + 1, 0, 1));
    }
  };

  // Go to today
  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Generate days for month view
  const generateMonthDays = () => {
    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    
    const startingDayOfWeek = firstDayOfMonth.getDay();
    const daysInMonth = lastDayOfMonth.getDate();
    
    // Previous month days to show
    const prevMonthDays = [];
    if (startingDayOfWeek > 0) {
      const prevMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0);
      const prevMonthDaysCount = prevMonth.getDate();
      
      for (let i = prevMonthDaysCount - startingDayOfWeek + 1; i <= prevMonthDaysCount; i++) {
        prevMonthDays.push({
          day: i,
          month: 'prev',
          date: new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, i)
        });
      }
    }
    
    // Current month days
    const currentMonthDays = [];
    for (let i = 1; i <= daysInMonth; i++) {
      currentMonthDays.push({
        day: i,
        month: 'current',
        date: new Date(currentDate.getFullYear(), currentDate.getMonth(), i)
      });
    }
    
    // Next month days to fill the grid
    const nextMonthDays = [];
    const totalDaysShown = prevMonthDays.length + currentMonthDays.length;
    const remainingDays = 42 - totalDaysShown; // 6 rows of 7 days
    
    for (let i = 1; i <= remainingDays; i++) {
      nextMonthDays.push({
        day: i,
        month: 'next',
        date: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, i)
      });
    }
    
    return [...prevMonthDays, ...currentMonthDays, ...nextMonthDays];
  };
  
  // Get events for a specific day
  const getEventsForDay = (date) => {
    return events.filter(event => {
      const eventDate = new Date(event.start);
      return (
        eventDate.getDate() === date.getDate() &&
        eventDate.getMonth() === date.getMonth() &&
        eventDate.getFullYear() === date.getFullYear()
      );
    });
  };
  
  // Check if a date is today
  const isToday = (date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };
  
  // Generate week days
  const generateWeekDays = () => {
    const startOfWeek = new Date(currentDate);
    const day = startOfWeek.getDay();
    startOfWeek.setDate(startOfWeek.getDate() - day);
    
    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(date.getDate() + i);
      weekDays.push(date);
    }
    
    return weekDays;
  };
  
  // Render month view
  const renderMonthView = () => {
    if (loading) {
      return <div className="loading">Loading meetings...</div>;
    }

    const days = generateMonthDays();
    
    return (
      <div>
        <div className="weekdays">
          {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((day) => (
            <div key={day}>{day}</div>
          ))}
        </div>
        <div className="month-view">
          {days.map((day, index) => {
            const dayEvents = getEventsForDay(day.date);
            const isCurrentDay = isToday(day.date);
            
            return (
              <div 
                key={index} 
                className={`day-cell ${day.month !== 'current' ? 'different-month' : ''} ${isCurrentDay ? 'today' : ''}`}
                onClick={() => handleDayClick(day.date)}
              >
                <div className={`day-number ${isCurrentDay ? 'current-day' : ''}`}>
                  {day.day}
                </div>
                <div className="events">
                  {dayEvents.slice(0, 2).map((event, eventIndex) => (
                    <EventCard 
                      key={eventIndex} 
                      event={event} 
                      index={eventIndex}
                      onClick={() => handleEventClick(event)}
                    />
                  ))}
                  {dayEvents.length > 2 && (
                    <div className="more-events">
                      +{dayEvents.length - 2} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };
  
  // Render day view with timeline
  const renderDayView = () => {
    if (loading) {
      return <div className="loading">Loading meetings...</div>;
    }

    const dayEvents = getEventsForDay(currentDate);
    
    // Get time window for today's schedule
    const timeWindow = getRelevantTimeWindow(dayEvents, currentTime);
    const timeSlots = getTimeSlots(timeWindow.startMinutes, timeWindow.endMinutes);
    
    // Filter events to show only relevant ones
    const visibleEvents = dayEvents.filter(event => {
      const eventStart = new Date(event.start);
      const eventEnd = new Date(event.end);
      const startMinutes = eventStart.getHours() * 60 + eventStart.getMinutes();
      const endMinutes = eventEnd.getHours() * 60 + eventEnd.getMinutes();

      // Show events that:
      // 1. End after current time (not completed)
      // 2. Fall within the visible time window
      return endMinutes > currentTime.getHours() * 60 + currentTime.getMinutes() &&
            startMinutes <= timeWindow.endMinutes &&
            endMinutes >= timeWindow.startMinutes;
    });

    const eventPositions = findOverlappingEvents(visibleEvents);
    
    return (
      <div>
        <div className="day-header">
          <div className="day-number selected">
            {currentDate.getDate()}
          </div>
          <div className="day-name">
            {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][currentDate.getDay()]}
          </div>
        </div>
        <div className="day-view-container">
          <h3 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#1a1a1a', margin: '0 0 1rem 0' }}>Day's Schedule</h3>
          <div className="timeline-container" style={{ 
            position: 'relative', 
            height: '300px', 
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            padding: '1rem',
            overflow: 'hidden',
            border: '1px solid #e2e8f0'
          }}>
            {/* Time slots */}
            <div style={{
              position: 'absolute',
              left: '0',
              top: '0',
              bottom: '0',
              width: '45px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              fontSize: '0.75rem',
              color: '#64748b',
              zIndex: 2,
              padding: '10px 0'
            }}>
              {timeSlots.map((slot, index) => (
                <div key={index} style={{
                  position: 'absolute',
                  top: `${(index * 100) / (timeSlots.length - 1)}%`,
                  width: '100%',
                  textAlign: 'right',
                  paddingRight: '0.5rem',
                  transform: 'translateY(-50%)',
                  fontSize: '0.65rem',
                  fontFamily: 'monospace'
                }}>
                  {slot.label}
                </div>
              ))}
            </div>

            {/* Current time line and indicator */}
            <div style={{
              position: 'absolute',
              left: '0',
              right: '0',
              top: `${((currentTime.getHours() * 60 + currentTime.getMinutes() - timeWindow.startMinutes) / 
                (timeWindow.endMinutes - timeWindow.startMinutes)) * 100}%`,
              zIndex: 3,
              transform: 'translateY(-50%)',
              display: 'flex',
              alignItems: 'center'
            }}>
              {/* Time display on left */}
              <div style={{
                width: '45px',
                fontSize: '0.75rem',
                color: '#10b981',
                fontWeight: '500',
                textAlign: 'right',
                paddingRight: '8px'
              }}>
                {formatCurrentTime(currentTime)}
              </div>

              {/* Time indicator dot */}
              <div style={{
                width: '10px',
                height: '10px',
                backgroundColor: '#10b981',
                borderRadius: '50%',
                boxShadow: '0 0 0 2px rgba(16, 185, 129, 0.2)',
                position: 'relative',
                zIndex: 2,
                marginLeft: '-5px'
              }} />

              {/* Horizontal line */}
              <div style={{
                position: 'absolute',
                left: '45px',
                right: '0',
                height: '2px',
                backgroundColor: '#10b981',
                opacity: 0.6,
                zIndex: 1
              }} />
            </div>

            {/* Timeline vertical line */}
            <div style={{
              position: 'absolute',
              left: '50px',
              top: '0',
              bottom: '0',
              width: '1px',
              backgroundColor: '#e2e8f0',
              zIndex: 1
            }} />

            {/* Events container */}
            <div style={{
              position: 'relative',
              height: '100%',
              marginLeft: '60px',
              paddingRight: '1rem',
              overflowX: 'auto' // Allow horizontal scroll for multiple events
            }}>
              {visibleEvents.map((event, index) => {
                const startTime = new Date(event.start);
                const endTime = new Date(event.end);
                const startMinutes = startTime.getHours() * 60 + startTime.getMinutes();
                const endMinutes = endTime.getHours() * 60 + endTime.getMinutes();
                
                const topPosition = ((startMinutes - timeWindow.startMinutes) / 
                  (timeWindow.endMinutes - timeWindow.startMinutes)) * 100;
                const height = ((endMinutes - startMinutes) / 
                  (timeWindow.endMinutes - timeWindow.startMinutes)) * 100;

                const position = eventPositions.get(event.id) || { 
                  width: '200px', 
                  left: '0px', 
                  groupSize: 1, 
                  groupIndex: 0,
                  totalInGroup: 1 
                };

                return (
                  <div
                    key={index}
                    style={{
                      position: 'absolute',
                      top: `${topPosition}%`,
                      left: position.left,
                      width: position.width,
                      height: `${height}%`,
                      zIndex: 2,
                      minHeight: '60px',
                      padding: '0 4px',
                      opacity: endMinutes < (currentTime.getHours() * 60 + currentTime.getMinutes()) ? 0.5 : 1
                    }}
                    onClick={() => handleEventClick(event)}
                  >
                    <div style={{
                      height: '100%',
                      position: 'relative'
                    }}>
                      <EventCard 
                        event={{
                          ...event,
                          start: startTime.toISOString(),
                          end: endTime.toISOString()
                        }}
                        index={index}
                      />
                      {position.totalInGroup > 1 && position.groupIndex === 0 && (
                        <div style={{
                          position: 'absolute',
                          top: '4px',
                          right: '-24px',
                          backgroundColor: 'rgba(0,0,0,0.1)',
                          borderRadius: '12px',
                          padding: '2px 6px',
                          fontSize: '0.7rem',
                          color: '#666',
                          zIndex: 3,
                          fontWeight: '500'
                        }}>
                          +{position.totalInGroup - 1}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  // Render view selector
  const renderViewSelector = () => {
    const viewOptions = {
      month: 'Month',
      day: 'Timeline'
    };
    
    const handleViewChange = (view) => {
      setCurrentView(view);
      setViewDropdownOpen(false);
    };
    
    return (
      <div className="view-selector">
        <button 
          className="view-button"
          onClick={() => setViewDropdownOpen(!viewDropdownOpen)}
        >
          {viewOptions[currentView]}
          <ChevronDown size={16} />
        </button>
        
        {viewDropdownOpen && (
          <div className="view-dropdown">
            {Object.entries(viewOptions).map(([key, label]) => (
              <div 
                key={key} 
                className={`view-option ${key === currentView ? 'active' : ''}`}
                onClick={() => handleViewChange(key)}
              >
                {label}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };
  
  return (
    <div className="calendar-container">
      <div className="calendar-header">
        <div className="calendar-nav">
          <button className="nav-button" onClick={goToPrevious}>
            <ChevronLeft size={18} />
          </button>
          <button className="nav-button today-button" onClick={goToToday}>
            Today
          </button>
          <button className="nav-button" onClick={goToNext}>
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="calendar-title">
          {currentView === 'month' ? `${monthName}, ${year}` : `${monthName} ${currentDate.getDate()}, ${year}`}
        </div>
        {renderViewSelector()}
      </div>
      {currentView === 'month' && renderMonthView()}
      {currentView === 'day' && renderDayView()}
    </div>
  );
};

Calendar.propTypes = {
  initialDate: PropTypes.instanceOf(Date),
  onEventClick: PropTypes.func
};

export default Calendar;