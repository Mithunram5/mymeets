import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { format, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, subDays, addDays, isSameMonth } from "date-fns";
import dayjs from "dayjs";
import axios from "axios";
import CreateMeeting from "../pages/CreateMeeting";
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import { Button, Typography } from "@mui/material";
import EventCard from './EventCard';

const getRelevantTimeWindow = (meetings, currentTime) => {
  const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
  
  // Get upcoming meetings
  const upcomingMeetings = meetings.filter(meeting => {
    const endTime = new Date(meeting.end);
    const endMinutes = endTime.getHours() * 60 + endTime.getMinutes();
    return endMinutes > currentMinutes;
  });

  if (upcomingMeetings.length === 0) {
    // If no upcoming meetings, show window around current time
    return {
      startMinutes: Math.floor(currentMinutes / 30) * 30 - 30, // Round to previous half hour
      endMinutes: Math.ceil(currentMinutes / 30) * 30 + 90    // Show next 1.5 hours
    };
  }

  // Find the earliest and latest times from upcoming meetings
  const meetingTimes = upcomingMeetings.flatMap(meeting => [
    new Date(meeting.start).getHours() * 60 + new Date(meeting.start).getMinutes(),
    new Date(meeting.end).getHours() * 60 + new Date(meeting.end).getMinutes()
  ]);

  const earliestMeetingTime = Math.min(...meetingTimes);
  const latestMeetingTime = Math.max(...meetingTimes);

  // Create a window that includes current time and upcoming meetings
  const startMinutes = Math.min(currentMinutes, earliestMeetingTime) - 30;
  const endMinutes = Math.max(currentMinutes + 60, latestMeetingTime + 30);

  // Ensure minimum 2-hour window
  if (endMinutes - startMinutes < 120) {
    return {
      startMinutes: startMinutes,
      endMinutes: startMinutes + 120
    };
  }

  return { startMinutes, endMinutes };
};

const getTimeSlots = (startMinutes, endMinutes) => {
  const slots = [];
  // Create time slots in 30-minute intervals
  let currentMinute = Math.floor(startMinutes / 30) * 30; // Round to nearest 30-min interval
  
  while (currentMinute <= endMinutes) {
    const hour = Math.floor(currentMinute / 60) % 24;
    const minute = currentMinute % 60;
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12; // Convert 0 to 12 for 12 AM
    
    slots.push({
      minutes: currentMinute,
      label: `${hour12}:${minute.toString().padStart(2, '0')} ${ampm}`
    });
    
    currentMinute += 30; // 30-minute intervals
  }

  return slots;
};

const findOverlappingMeetings = (meetings) => {
  // Sort meetings by start time and then by title for consistent ordering
  const sortedMeetings = [...meetings].sort((a, b) => {
    const timeCompare = new Date(a.start) - new Date(b.start);
    if (timeCompare === 0) {
      return a.title.localeCompare(b.title);
    }
    return timeCompare;
  });
  
  // Group overlapping meetings
  const groups = [];
  let currentGroup = [];
  
  sortedMeetings.forEach((meeting) => {
    const meetingStart = new Date(meeting.start);
    const meetingEnd = new Date(meeting.end);
    
    const overlapsWithGroup = currentGroup.some(groupMeeting => {
      const groupStart = new Date(groupMeeting.start);
      const groupEnd = new Date(groupMeeting.end);
      return (meetingStart.getTime() === groupStart.getTime() && 
              meetingEnd.getTime() === groupEnd.getTime());
    });
    
    if (overlapsWithGroup) {
      currentGroup.push(meeting);
    } else {
      if (currentGroup.length > 0) {
        groups.push([...currentGroup]);
      }
      currentGroup = [meeting];
    }
  });
  
  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }
  
  // Calculate position info for each meeting
  const meetingPositions = new Map();
  groups.forEach(group => {
    const groupSize = group.length;
    group.forEach((meeting, index) => {
      meetingPositions.set(meeting.id, {
        width: '200px', // Fixed width for all meetings
        left: `${index * 210}px`, // Add some gap between meetings
        groupSize,
        groupIndex: index,
        totalInGroup: groupSize
      });
    });
  });
  
  return meetingPositions;
};

const weekDays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

const formatCurrentTime = (date) => {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};

const DashboardRightPanel = () => {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showCreateMeeting, setShowCreateMeeting] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [meetings, setMeetings] = useState([]);

  // Fetch meetings from the API using the approach from Dashboard.jsx
  const fetchMeetings = async () => {
    try {
      const token = localStorage.getItem('token'); // Ensure token is saved at login
      const response = await axios.get('http://localhost:5000/api/meetings/get-user-meetings', {
        headers: {
          Authorization: `Bearer ${token}`,
        }
      });

      if (response.data.success) {
        const formattedMeetings = response.data.meetings.map(meeting => ({
          id: meeting.id,
          title: meeting.meeting_name,
          start: new Date(meeting.start_time),
          end: new Date(meeting.end_time),
          type: meeting.role || "meeting",
          color: getRandomColor(meeting.id),
          description: meeting.meeting_description,
          priority: meeting.priority,
          status: meeting.meeting_status
        }));

        setMeetings(formattedMeetings);
      }
    } catch (error) {
      console.error("Failed to fetch meetings:", error);
    }
  };

  useEffect(() => {
    fetchMeetings();
    // Refresh meetings every minute
    const interval = setInterval(fetchMeetings, 60000);
    return () => clearInterval(interval);
  }, []);

  // Function to get a consistent color based on meeting ID
  const getRandomColor = (id) => {
    const colors = ['#4299e1', '#48bb78', '#ed8936', '#9f7aea', '#ed64a6', '#667eea'];
    const numericId = parseInt(id.toString().replace(/[^0-9]/g, '')) || 0;
    return colors[numericId % colors.length];
  };

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Get relevant time window
  const timeWindow = getRelevantTimeWindow(meetings, currentTime);
  const timeSlots = getTimeSlots(timeWindow.startMinutes, timeWindow.endMinutes);

  // Filter meetings to show only relevant ones
  const visibleMeetings = meetings.filter(meeting => {
    const meetingStart = new Date(meeting.start);
    const meetingEnd = new Date(meeting.end);
    const startMinutes = meetingStart.getHours() * 60 + meetingStart.getMinutes();
    const endMinutes = meetingEnd.getHours() * 60 + meetingEnd.getMinutes();

    // Show meetings that:
    // 1. End after current time (not completed)
    // 2. Fall within the visible time window
    return endMinutes > currentTime.getHours() * 60 + currentTime.getMinutes() &&
           startMinutes <= timeWindow.endMinutes &&
           endMinutes >= timeWindow.startMinutes;
  });

  const meetingPositions = findOverlappingMeetings(visibleMeetings);

  useEffect(() => {
    const interval = setInterval(() => {
      setSelectedDate(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);
  
  const getCalendarDays = (date) => {
    const start = startOfMonth(date);
    const end = endOfMonth(date);
    const startDay = start.getDay();
    const endDay = end.getDay();

    const daysBefore = Array.from({ length: startDay }, (_, i) => subDays(start, startDay - i));
    const daysInMonth = eachDayOfInterval({ start, end });
    const daysAfter = Array.from({ length: 6 - endDay }, (_, i) => addDays(end, i + 1));

    return [...daysBefore, ...daysInMonth, ...daysAfter];
  };

  const handleCreateMeetingClick = () => {
    setShowCreateMeeting(true);
  };

  const handleTemplateSelect = (selectedTemplate) => {
    setShowCreateMeeting(false);
    navigate('/cmeeting', { state: { selectedTemplate } });
  };

  const days = getCalendarDays(selectedDate);

  const handleViewMoreCalendar = () => {
    navigate('/calendar');
  }; 

  // Current time line and indicator
  const renderCurrentTimeLine = () => {
    const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
    const position = ((currentMinutes - timeWindow.startMinutes) / 
      (timeWindow.endMinutes - timeWindow.startMinutes)) * 100;
    
    if (position < 0 || position > 100) return null;

    return (
      <div style={{
        position: 'absolute',
        left: '0',
        right: '0',
        top: `${position}%`,
        zIndex: 3,
        transform: 'translateY(-50%)',
        display: 'flex',
        alignItems: 'center'
      }}>
        {/* Time indicator dot */}
        <div style={{
          width: '10px',
          height: '10px',
          backgroundColor: '#10b981',
          borderRadius: '50%',
          boxShadow: '0 0 0 2px rgba(16, 185, 129, 0.2)',
          position: 'relative',
          zIndex: 2,
          marginLeft: '40px'
        }} />

        {/* Time display to the right of dot and above the line */}
        <div style={{
          fontSize: '0.75rem',
          color: '#10b981',
          fontWeight: '500',
          position: 'absolute',
          left: '55px',
          top: '-16px'
        }}>
          {formatCurrentTime(currentTime)}
        </div>

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
    );
  };

  return (
    <>
      {showCreateMeeting && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999
          }}
        >
          <CreateMeeting
            onUseTemplate={handleTemplateSelect}
            onClose={() => setShowCreateMeeting(false)}
          />
        </div>
      )}
      
      <div style={{ display: 'flex', flexDirection: 'column' , gap:'5px',marginTop:'16px'}}>
        <div>
            <button style={{
              padding: '0.5rem',
              backgroundColor: '#27ae60',
              color: 'white',
              border: 'none',
              fontSize: '1rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              textAlign: 'center',
              width:'100%',
              borderRadius: '5px'
            }} onClick={handleCreateMeetingClick}>
              <AddCircleOutlineIcon/>
              Create Meeting
            </button>
        </div>
        
        <div style={{ flex: 1, backgroundColor: 'white', borderRadius: '0.5rem', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem'}}>
          <div style={{ backgroundColor: 'white', padding: '0.25rem', borderRadius: '0.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', color: 'black' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#1a1a1a', margin: 0 }}>{format(selectedDate, 'MMM dd-yyyy')}</h2>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Button
                  onClick={handleViewMoreCalendar}
                  sx={{
                    textTransform: 'none',
                    color: '#1A202C',
                    padding: 0,
                    gap: '5px',
                    '&:hover': {
                      backgroundColor: 'transparent',
                      textDecoration: 'underline',
                    },
                  }}
                >
                  <CalendarMonthOutlinedIcon sx={{ fontSize: 20 }} />
                  <Typography
                    sx={{
                      fontStyle: 'italic',
                      fontWeight: 500,
                      fontSize: '16px',
                      color: '#1A202C',
                    }}
                  >
                    view all
                  </Typography>
                </Button>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem'}}>
              {weekDays.map(day => (
                <div key={day} style={{ textAlign: 'center', fontWeight: 600, color: '#666', padding: '0.25rem', fontSize: '0.75rem' }}>{day}</div>
              ))}
              {days.map(day => (
                <div
                  key={day.toString()}
                  style={{
                    aspectRatio: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    borderRadius: '50%',
                    position: 'relative',
                    fontSize: '0.875rem',
                    color: isSameMonth(day, selectedDate) ? '#1a1a1a' : '#ccc',
                    width: '30px',
                    height: '30px',
                    margin: 'auto',
                    backgroundColor: isSameDay(day, selectedDate) ? '#4299e1' : 'transparent'
                  }}
                  onClick={() => setSelectedDate(day)}
                >
                  {format(day, 'd')}
                  {meetings.some(meeting => {
                    const meetingDate = new Date(meeting.start);
                    return isSameDay(meetingDate, day);
                  }) && (
                    <div style={{ width: '3px', height: '3px', backgroundColor: '#e1a942', borderRadius: '50%', position: 'absolute', bottom: '2px' }} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Schedule Section */}
            <h3 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#1a1a1a', margin: '0 0 1rem 0' }}>Today's Schedule</h3>
            <div style={{ 
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
                    top: `${((slot.minutes - timeWindow.startMinutes) / (timeWindow.endMinutes - timeWindow.startMinutes)) * 100}%`,
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
              {renderCurrentTimeLine()}

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
                overflowX: 'auto' // Allow horizontal scroll for multiple meetings
              }}>
                {visibleMeetings.map((meeting, index) => {
                  const startTime = new Date(meeting.start);
                  const endTime = new Date(meeting.end);
                  const startMinutes = startTime.getHours() * 60 + startTime.getMinutes();
                  const endMinutes = endTime.getHours() * 60 + endTime.getMinutes();
                  
                  const topPosition = ((startMinutes - timeWindow.startMinutes) / 
                    (timeWindow.endMinutes - timeWindow.startMinutes)) * 100;
                  const height = ((endMinutes - startMinutes) / 
                    (timeWindow.endMinutes - timeWindow.startMinutes)) * 100;

                  const position = meetingPositions.get(meeting.id) || { 
                    width: '200px', 
                    left: '0px', 
                    groupSize: 1, 
                    groupIndex: 0,
                    totalInGroup: 1 
                  };

                  // Only render if event falls within the visible range
                  if (topPosition < 0 && topPosition + height <= 0) return null;
                  if (topPosition >= 100) return null;

                  return (
                    <div
                      key={meeting.id || index}
                      style={{
                        position: 'absolute',
                        top: `${Math.max(0, topPosition)}%`,
                        left: position.left,
                        width: position.width,
                        height: `${Math.min(100 - topPosition, height)}%`,
                        zIndex: 2,
                        minHeight: '60px',
                        padding: '0 4px',
                        opacity: endMinutes < (currentTime.getHours() * 60 + currentTime.getMinutes()) ? 0.5 : 1
                      }}
                    >
                      <div style={{
                        height: '100%',
                        position: 'relative'
                      }}>
                        <EventCard 
                          event={{
                            ...meeting,
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
    </>
  );
};

export default DashboardRightPanel;