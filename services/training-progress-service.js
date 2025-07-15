/**
 * Training Progress Service
 * Retrieves and analyzes training data from quote_sessions and quote_items
 */

class TrainingProgressService {
    constructor() {
        this.baseURL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api';
        this.taskNames = {
            '1': 'Customer Completed Order Notifications',
            '2': 'Thank You Notes',
            '3': 'Sample Management'
        };
    }

    /**
     * Get training history for a specific user
     * @param {string} email - User email
     * @param {string} startDate - Start date (YYYY-MM-DD)
     * @param {string} endDate - End date (YYYY-MM-DD)
     * @returns {Object} Training data with statistics
     */
    async getUserTrainingHistory(email, startDate, endDate) {
        try {
            // Get all task sessions for the user
            const sessions = await this.getTaskSessions(email, startDate, endDate);
            
            // Calculate statistics
            const stats = this.calculateStatistics(sessions);
            
            // Get daily progress
            const dailyProgress = this.calculateDailyProgress(sessions);
            
            // Get task breakdown
            const taskBreakdown = this.calculateTaskBreakdown(sessions);
            
            return {
                email: email,
                sessions: sessions,
                totalDays: stats.totalDays,
                completionRate: stats.completionRate,
                avgTimeMinutes: stats.avgTimeMinutes,
                currentStreak: stats.currentStreak,
                taskBreakdown: taskBreakdown,
                dailyProgress: dailyProgress
            };
        } catch (error) {
            console.error('Error getting user training history:', error);
            throw error;
        }
    }

    /**
     * Get task sessions from the API
     */
    async getTaskSessions(email = null, startDate = null, endDate = null) {
        try {
            // Build query parameters
            const params = new URLSearchParams();
            if (email) {
                params.append('customerEmail', email);
            }
            
            // Get sessions with TASK prefix
            const response = await fetch(`${this.baseURL}/quote_sessions?${params.toString()}`);
            if (!response.ok) {
                throw new Error(`Failed to fetch sessions: ${response.status}`);
            }
            
            const sessions = await response.json();
            
            // Filter for TASK sessions only
            const taskSessions = sessions.filter(session => 
                session.QuoteID && session.QuoteID.startsWith('TASK')
            );
            
            // Filter by date range if provided
            const filteredSessions = this.filterByDateRange(taskSessions, startDate, endDate);
            
            // Get items for each session
            const sessionsWithItems = await Promise.all(
                filteredSessions.map(async (session) => {
                    const items = await this.getSessionItems(session.QuoteID);
                    return {
                        ...session,
                        items: items
                    };
                })
            );
            
            return sessionsWithItems;
        } catch (error) {
            console.error('Error fetching task sessions:', error);
            return [];
        }
    }

    /**
     * Get items for a specific session
     */
    async getSessionItems(quoteID) {
        try {
            const response = await fetch(`${this.baseURL}/quote_items?quoteID=${quoteID}`);
            if (!response.ok) {
                throw new Error(`Failed to fetch items: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error fetching session items:', error);
            return [];
        }
    }

    /**
     * Filter sessions by date range
     */
    filterByDateRange(sessions, startDate, endDate) {
        if (!startDate && !endDate) return sessions;
        
        const start = startDate ? new Date(startDate) : new Date('2000-01-01');
        const end = endDate ? new Date(endDate + 'T23:59:59') : new Date();
        
        return sessions.filter(session => {
            const sessionDate = new Date(session.CreatedAt);
            return sessionDate >= start && sessionDate <= end;
        });
    }

    /**
     * Calculate statistics from sessions
     */
    calculateStatistics(sessions) {
        if (sessions.length === 0) {
            return {
                totalDays: 0,
                completionRate: 0,
                avgTimeMinutes: 0,
                currentStreak: 0
            };
        }

        // Calculate unique training days
        const uniqueDays = new Set(
            sessions.map(session => 
                new Date(session.CreatedAt).toDateString()
            )
        );
        const totalDays = uniqueDays.size;

        // Calculate completion rate
        let totalTasks = 0;
        let completedTasks = 0;
        
        sessions.forEach(session => {
            session.items.forEach(item => {
                totalTasks++;
                if (item.Quantity > 0) {
                    completedTasks++;
                }
            });
        });
        
        const completionRate = totalTasks > 0 
            ? Math.round((completedTasks / totalTasks) * 100) 
            : 0;

        // Calculate average time
        let totalTime = 0;
        let taskCount = 0;
        
        sessions.forEach(session => {
            session.items.forEach(item => {
                try {
                    // Parse timer data from the new dedicated TimerData_ field
                    let taskData = {};
                    try {
                        taskData = JSON.parse(item.TimerData_ || '{}');
                    } catch (e) {
                        // Fallback to old ColorCode field for backward compatibility
                        try {
                            taskData = JSON.parse(item.ColorCode || '{}');
                        } catch (e2) {
                            taskData = {};
                        }
                    }
                    if (taskData.totalSeconds) {
                        totalTime += taskData.totalSeconds;
                        taskCount++;
                    }
                } catch (e) {
                    console.error('Error parsing task data:', e);
                }
            });
        });
        
        const avgTimeMinutes = taskCount > 0 
            ? Math.round(totalTime / taskCount / 60) 
            : 0;

        // Calculate current streak
        const currentStreak = this.calculateStreak(sessions);

        return {
            totalDays,
            completionRate,
            avgTimeMinutes,
            currentStreak
        };
    }

    /**
     * Calculate current streak
     */
    calculateStreak(sessions) {
        if (sessions.length === 0) return 0;

        // Sort sessions by date (newest first)
        const sortedSessions = [...sessions].sort((a, b) => 
            new Date(b.CreatedAt) - new Date(a.CreatedAt)
        );

        // Get unique dates
        const dates = [...new Set(
            sortedSessions.map(session => 
                new Date(session.CreatedAt).toDateString()
            )
        )].map(dateStr => new Date(dateStr));

        // Sort dates (newest first)
        dates.sort((a, b) => b - a);

        let streak = 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (let i = 0; i < dates.length; i++) {
            const expectedDate = new Date(today);
            expectedDate.setDate(expectedDate.getDate() - i);
            expectedDate.setHours(0, 0, 0, 0);

            if (dates[i].getTime() === expectedDate.getTime()) {
                streak++;
            } else {
                break;
            }
        }

        return streak;
    }

    /**
     * Calculate task breakdown
     */
    calculateTaskBreakdown(sessions) {
        const breakdown = {};

        sessions.forEach(session => {
            session.items.forEach(item => {
                const taskId = item.StyleNumber;
                
                if (!breakdown[taskId]) {
                    breakdown[taskId] = {
                        taskName: this.taskNames[taskId] || item.ProductName,
                        completedCount: 0,
                        totalCount: 0,
                        totalTime: 0
                    };
                }

                breakdown[taskId].totalCount++;
                
                if (item.Quantity > 0) {
                    breakdown[taskId].completedCount++;
                    
                    try {
                        // Parse timer data from the new dedicated TimerData_ field
                    let taskData = {};
                    try {
                        taskData = JSON.parse(item.TimerData_ || '{}');
                    } catch (e) {
                        // Fallback to old ColorCode field for backward compatibility
                        try {
                            taskData = JSON.parse(item.ColorCode || '{}');
                        } catch (e2) {
                            taskData = {};
                        }
                    }
                        if (taskData.totalSeconds) {
                            breakdown[taskId].totalTime += taskData.totalSeconds / 60; // Convert to minutes
                        }
                    } catch (e) {
                        console.error('Error parsing task data:', e);
                    }
                }
            });
        });

        return breakdown;
    }

    /**
     * Calculate daily progress
     */
    calculateDailyProgress(sessions) {
        const dailyData = {};

        sessions.forEach(session => {
            const date = new Date(session.CreatedAt).toDateString();
            
            if (!dailyData[date]) {
                dailyData[date] = {
                    date: new Date(date),
                    totalTasks: 0,
                    completedTasks: 0,
                    totalMinutes: 0
                };
            }

            session.items.forEach(item => {
                dailyData[date].totalTasks++;
                
                if (item.Quantity > 0) {
                    dailyData[date].completedTasks++;
                    
                    try {
                        // Parse timer data from the new dedicated TimerData_ field
                    let taskData = {};
                    try {
                        taskData = JSON.parse(item.TimerData_ || '{}');
                    } catch (e) {
                        // Fallback to old ColorCode field for backward compatibility
                        try {
                            taskData = JSON.parse(item.ColorCode || '{}');
                        } catch (e2) {
                            taskData = {};
                        }
                    }
                        if (taskData.totalSeconds) {
                            dailyData[date].totalMinutes += taskData.totalSeconds / 60;
                        }
                    } catch (e) {
                        console.error('Error parsing task data:', e);
                    }
                }
            });
        });

        // Convert to array and sort by date
        const dailyProgress = Object.values(dailyData)
            .map(day => ({
                ...day,
                completionRate: day.totalTasks > 0 
                    ? Math.round((day.completedTasks / day.totalTasks) * 100)
                    : 0,
                totalMinutes: Math.round(day.totalMinutes),
                tasksCompleted: day.completedTasks
            }))
            .sort((a, b) => a.date - b.date);

        return dailyProgress;
    }

    /**
     * Get progress for all users
     */
    async getAllUsersProgress(startDate, endDate) {
        try {
            // Get all task sessions
            const allSessions = await this.getTaskSessions(null, startDate, endDate);
            
            // Group by user
            const userSessions = {};
            allSessions.forEach(session => {
                const email = session.CustomerEmail || 'unknown';
                if (!userSessions[email]) {
                    userSessions[email] = [];
                }
                userSessions[email].push(session);
            });

            // Calculate stats for each user
            const userProgress = [];
            for (const [email, sessions] of Object.entries(userSessions)) {
                const stats = this.calculateStatistics(sessions);
                const taskBreakdown = this.calculateTaskBreakdown(sessions);
                const dailyProgress = this.calculateDailyProgress(sessions);
                
                userProgress.push({
                    email: email,
                    name: sessions[0]?.CustomerName || email,
                    sessions: sessions,
                    totalDays: stats.totalDays,
                    completionRate: stats.completionRate,
                    avgTimeMinutes: stats.avgTimeMinutes,
                    currentStreak: stats.currentStreak,
                    taskBreakdown: taskBreakdown,
                    dailyProgress: dailyProgress
                });
            }

            // Sort by completion rate
            userProgress.sort((a, b) => b.completionRate - a.completionRate);

            return userProgress;
        } catch (error) {
            console.error('Error getting all users progress:', error);
            throw error;
        }
    }

    /**
     * Generate progress report
     */
    async generateProgressReport(email, dateRange) {
        const data = await this.getUserTrainingHistory(
            email, 
            dateRange.start, 
            dateRange.end
        );

        const report = {
            generatedAt: new Date().toISOString(),
            user: email,
            dateRange: dateRange,
            summary: {
                totalTrainingDays: data.totalDays,
                completionRate: data.completionRate,
                averageTimePerTask: data.avgTimeMinutes,
                currentStreak: data.currentStreak
            },
            taskPerformance: data.taskBreakdown,
            dailyProgress: data.dailyProgress,
            recommendations: this.generateRecommendations(data)
        };

        return report;
    }

    /**
     * Generate recommendations based on performance
     */
    generateRecommendations(data) {
        const recommendations = [];

        // Check completion rate
        if (data.completionRate < 80) {
            recommendations.push({
                type: 'improvement',
                message: 'Focus on completing all assigned tasks to improve your completion rate.'
            });
        }

        // Check average time
        if (data.avgTimeMinutes > 60) {
            recommendations.push({
                type: 'efficiency',
                message: 'Practice tasks to reduce completion time. Target: under 45 minutes per task.'
            });
        }

        // Check streak
        if (data.currentStreak === 0) {
            recommendations.push({
                type: 'consistency',
                message: 'Build consistency by completing tasks daily to maintain a streak.'
            });
        } else if (data.currentStreak >= 5) {
            recommendations.push({
                type: 'achievement',
                message: `Great job maintaining a ${data.currentStreak}-day streak! Keep it up!`
            });
        }

        // Check task-specific performance
        Object.entries(data.taskBreakdown).forEach(([taskId, taskData]) => {
            const completionRate = taskData.totalCount > 0 
                ? (taskData.completedCount / taskData.totalCount) * 100 
                : 0;
                
            if (completionRate < 70) {
                recommendations.push({
                    type: 'task-specific',
                    message: `Need more practice with ${taskData.taskName}. Current completion: ${Math.round(completionRate)}%`
                });
            }
        });

        return recommendations;
    }
}

// Make available globally
window.TrainingProgressService = TrainingProgressService;