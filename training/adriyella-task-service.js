/**
 * Adriyella Task Tracking Service
 * Uses the existing quote API to track daily tasks
 */

class TaskTrackingService {
    constructor() {
        this.baseURL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
        this.prefix = 'TASK';
        this.userEmail = 'adriyella@nwcustomapparel.com';
        this.userName = 'Adriyella - Daily Tasks';
    }

    /**
     * Generate unique task quote ID for the day
     * Format: TASK{MMDD}-1
     */
    generateTaskQuoteID() {
        const now = new Date();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const day = now.getDate().toString().padStart(2, '0');
        return `${this.prefix}${month}${day}-1`;
    }

    /**
     * Generate session ID for tracking
     */
    generateSessionID() {
        return `task_sess_${Date.now()}_adriyella`;
    }

    /**
     * Get or create today's task session
     */
    async getTodaySession() {
        const quoteID = this.generateTaskQuoteID();
        
        try {
            // Check if session already exists
            const response = await fetch(`${this.baseURL}/api/quote_sessions?quoteID=${quoteID}`);
            const sessions = await response.json();
            
            if (sessions && sessions.length > 0) {
                return sessions[0];
            }
            
            // Create new session for today
            return await this.createDailySession();
        } catch (error) {
            console.error('[TaskService] Error getting session:', error);
            return null;
        }
    }

    /**
     * Create a new daily task session
     */
    async createDailySession() {
        const sessionData = {
            QuoteID: this.generateTaskQuoteID(),
            SessionID: this.generateSessionID(),
            CustomerEmail: this.userEmail,
            CustomerName: this.userName,
            CompanyName: 'Internal - Office Tasks',
            Phone: '',
            TotalQuantity: 0, // Will update as tasks complete
            SubtotalAmount: 0, // Total seconds worked
            LTMFeeTotal: 0,
            TotalAmount: 0, // Total minutes (display friendly)
            Status: 'In Progress',
            ExpiresAt: this.getEndOfDay(),
            Notes: ''
        };

        try {
            const response = await fetch(`${this.baseURL}/api/quote_sessions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(sessionData)
            });

            if (!response.ok) {
                // Get detailed error message from response
                let errorMessage = `Failed to create session: ${response.status}`;
                try {
                    const errorText = await response.text();
                    console.error('[TaskService] Session creation error response:', errorText);
                    errorMessage += ` - ${errorText}`;
                } catch (e) {
                    console.error('[TaskService] Could not read session error response');
                }
                throw new Error(errorMessage);
            }

            console.log('[TaskService] Created new daily session:', sessionData.QuoteID);
            return sessionData;
        } catch (error) {
            console.error('[TaskService] Error creating session:', error);
            return null;
        }
    }

    /**
     * Save task completion with timer data
     */
    async saveTaskCompletion(taskId, taskData) {
        const quoteID = this.generateTaskQuoteID();
        
        // Handle both old numeric IDs and new dynamic task IDs
        let taskNumber;
        let taskName;
        
        if (typeof taskId === 'number' || !isNaN(parseInt(taskId))) {
            // Old system with hardcoded task numbers
            taskNumber = parseInt(taskId);
            const taskNames = {
                1: 'Customer Completed Order Notifications',
                2: 'Thank You Notes',
                3: 'Sample Management'
            };
            taskName = taskNames[taskNumber] || `Task ${taskNumber}`;
        } else {
            // New dynamic task system
            // Generate a unique line number based on the task ID
            // Use a hash of the task ID to get a consistent number
            let hash = 0;
            for (let i = 0; i < taskId.length; i++) {
                const char = taskId.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash; // Convert to 32bit integer
            }
            taskNumber = Math.abs(hash) % 1000 + 100; // Keep it in range 100-1099
            
            // Use the provided task name or extract from data
            taskName = taskData.taskName || taskId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        }

        // Create complete timer data for the new dedicated field
        const timerData = {
            startTime: taskData.startTime,
            endTime: taskData.endTime,
            totalSeconds: taskData.totalSeconds || 0,
            totalMinutes: Math.round((taskData.totalSeconds || 0) / 60),
            taskCount: taskData.count || 1,
            timerSessions: taskData.timerSessions || [],
            pauseCount: (taskData.timerSessions || []).length - 1,
            details: taskData.details || {},
            notes: taskData.notes || '',
            taskId: taskId, // Store the original task ID for reference
            metadata: {
                version: '2.1',
                savedAt: new Date().toISOString()
            }
        };

        const itemData = {
            QuoteID: quoteID,
            LineNumber: taskNumber,
            StyleNumber: taskId.toString(), // Use the task ID as StyleNumber for better tracking
            ProductName: taskName,
            Color: 'Completed',
            ColorCode: '', // Clear - no longer used for timer data
            EmbellishmentType: 'task',
            PrintLocation: 'Office',
            PrintLocationName: 'Office Tasks',
            Quantity: parseInt(taskData.count || 1),
            HasLTM: 'No',
            BaseUnitPrice: taskData.totalSeconds ? Math.round(taskData.totalSeconds / (taskData.count || 1)) : 0,
            LTMPerUnit: 0,
            FinalUnitPrice: taskData.totalSeconds ? Math.round(taskData.totalSeconds / (taskData.count || 1)) : 0,
            LineTotal: taskData.totalSeconds || 0,
            SizeBreakdown: '{}', // Keep simple for compatibility
            PricingTier: 'Daily',
            ImageURL: '',
            AddedAt: new Date().toISOString().replace(/\.\d{3}Z$/, ''),
            TimerData_: JSON.stringify(timerData) // Use the new dedicated field!
        };

        // Log timer data information
        console.log('[TaskService] TimerData_ length:', itemData.TimerData_.length, 'chars');
        console.log('[TaskService] Timer sessions count:', timerData.timerSessions.length);
        console.log('[TaskService] Saving task with dedicated TimerData_ field:', itemData);

        try {
            // First ensure the session exists
            const session = await this.getTodaySession();
            if (!session) {
                console.error('[TaskService] No session found for today');
                throw new Error('No session found for today');
            }
            console.log('[TaskService] Session exists:', session.QuoteID);

            // Check if task already exists
            const existingResponse = await fetch(`${this.baseURL}/api/quote_items?quoteID=${quoteID}`);
            const existingItems = await existingResponse.json();
            const existingTask = existingItems.find(item => item.LineNumber === taskNumber);

            let response;
            if (existingTask) {
                // Update existing task
                response = await fetch(`${this.baseURL}/api/quote_items/${existingTask.PK_ID}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(itemData)
                });
            } else {
                // Create new task
                response = await fetch(`${this.baseURL}/api/quote_items`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(itemData)
                });
            }

            if (!response.ok) {
                // Get detailed error message from response
                let errorMessage = `Failed to save task: ${response.status}`;
                try {
                    const errorText = await response.text();
                    console.error('[TaskService] Error response body:', errorText);
                    errorMessage += ` - ${errorText}`;
                } catch (e) {
                    console.error('[TaskService] Could not read error response');
                }
                throw new Error(errorMessage);
            }

            console.log(`[TaskService] Task ${taskNumber} saved successfully`);
            
            // Update session totals
            await this.updateSessionTotals();
            
            return true;
        } catch (error) {
            console.error('[TaskService] Error saving task:', error);
            return false;
        }
    }

    /**
     * Get today's tasks
     */
    async getTodayTasks() {
        const quoteID = this.generateTaskQuoteID();
        
        try {
            const response = await fetch(`${this.baseURL}/api/quote_items?quoteID=${quoteID}`);
            const items = await response.json();
            
            // Parse and return task data
            return items.map(item => {
                let timerData = {};
                try {
                    // Parse timer data from the new dedicated TimerData_ field
                    timerData = JSON.parse(item.TimerData_ || '{}');
                } catch (e) {
                    console.error('Error parsing timer data from TimerData_ field:', e);
                    // Fallback: try old ColorCode field for backward compatibility
                    try {
                        timerData = JSON.parse(item.ColorCode || '{}');
                        console.log('[TaskService] Fell back to ColorCode field for task', item.LineNumber);
                    } catch (e2) {
                        timerData = {};
                    }
                }
                
                return {
                    taskNumber: item.LineNumber,
                    taskName: item.ProductName,
                    completed: item.Color === 'Completed',
                    count: item.Quantity,
                    totalSeconds: item.LineTotal,
                    totalMinutes: Math.round(item.LineTotal / 60),
                    details: timerData, // Now contains full timer data structure
                    pkId: item.PK_ID
                };
            });
        } catch (error) {
            console.error('[TaskService] Error getting tasks:', error);
            return [];
        }
    }

    /**
     * Update session totals based on completed tasks
     */
    async updateSessionTotals() {
        const session = await this.getTodaySession();
        if (!session) return;

        const tasks = await this.getTodayTasks();
        
        const totalSeconds = tasks.reduce((sum, task) => sum + (task.totalSeconds || 0), 0);
        const completedCount = tasks.filter(task => task.completed).length;
        
        const updateData = {
            TotalQuantity: completedCount,
            SubtotalAmount: totalSeconds,
            TotalAmount: Math.round(totalSeconds / 60) // Minutes
        };

        try {
            const response = await fetch(`${this.baseURL}/api/quote_sessions/${session.PK_ID}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updateData)
            });

            if (!response.ok) {
                throw new Error(`Failed to update session: ${response.status}`);
            }

            console.log('[TaskService] Session totals updated');
        } catch (error) {
            console.error('[TaskService] Error updating session:', error);
        }
    }

    /**
     * Submit daily report
     */
    async submitDailyReport(notes) {
        const session = await this.getTodaySession();
        if (!session) return false;

        const updateData = {
            Status: 'Completed',
            Notes: notes || 'Daily tasks completed'
        };

        try {
            const response = await fetch(`${this.baseURL}/api/quote_sessions/${session.PK_ID}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updateData)
            });

            if (!response.ok) {
                throw new Error(`Failed to submit report: ${response.status}`);
            }

            console.log('[TaskService] Daily report submitted');
            return true;
        } catch (error) {
            console.error('[TaskService] Error submitting report:', error);
            return false;
        }
    }

    /**
     * Get task history for date range
     */
    async getTaskHistory(days = 7) {
        try {
            const response = await fetch(
                `${this.baseURL}/api/quote_sessions?customerEmail=${this.userEmail}&q.orderBy=CreatedAt DESC&q.limit=${days}`
            );
            const sessions = await response.json();
            
            // Filter only task quotes
            return sessions.filter(s => s.QuoteID && s.QuoteID.startsWith(this.prefix));
        } catch (error) {
            console.error('[TaskService] Error getting history:', error);
            return [];
        }
    }

    /**
     * Calculate streak (consecutive days with all tasks completed)
     */
    async calculateStreak() {
        const history = await this.getTaskHistory(30);
        let streak = 0;
        const today = new Date();
        
        for (let i = 0; i < 30; i++) {
            const checkDate = new Date(today);
            checkDate.setDate(checkDate.getDate() - i);
            const dateStr = this.formatDateForQuoteID(checkDate);
            
            const daySession = history.find(h => h.QuoteID === `${this.prefix}${dateStr}-1`);
            
            if (daySession && daySession.Status === 'Completed' && daySession.TotalQuantity === 3) {
                streak++;
            } else if (i > 0) { // Don't break on today if not complete
                break;
            }
        }
        
        return streak;
    }

    /**
     * Helper: Format date for quote ID
     */
    formatDateForQuoteID(date) {
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${month}${day}`;
    }

    /**
     * UPDATE: Edit existing task completion
     */
    async updateTaskCompletion(taskId, updates) {
        try {
            console.log(`[TaskService] Updating task ${taskId}:`, updates);

            // Build update data based on what's provided
            const updateData = {};
            
            if (updates.count !== undefined) {
                updateData.Quantity = parseInt(updates.count);
            }
            
            if (updates.totalSeconds !== undefined) {
                updateData.LineTotal = parseInt(updates.totalSeconds);
                updateData.FinalUnitPrice = updates.count ? Math.round(updates.totalSeconds / updates.count) : 0;
            }
            
            if (updates.completed !== undefined) {
                updateData.Color = updates.completed ? 'Completed' : 'In Progress';
            }
            
            if (updates.timerData) {
                updateData.TimerData_ = JSON.stringify(updates.timerData);
            }
            
            if (updates.notes !== undefined) {
                // Update timer data with new notes
                const currentTask = await this.getTaskById(taskId);
                if (currentTask) {
                    let timerData = {};
                    try {
                        timerData = JSON.parse(currentTask.TimerData_ || '{}');
                    } catch (e) {
                        timerData = {};
                    }
                    timerData.notes = updates.notes;
                    timerData.lastModified = new Date().toISOString();
                    updateData.TimerData_ = JSON.stringify(timerData);
                }
            }

            const response = await fetch(`${this.baseURL}/api/quote_items/${taskId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updateData)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to update task: ${response.status} - ${errorText}`);
            }

            console.log(`[TaskService] Task ${taskId} updated successfully`);
            return { success: true };
        } catch (error) {
            console.error('[TaskService] Error updating task:', error);
            throw error;
        }
    }

    /**
     * READ: Get specific task by ID
     */
    async getTaskById(taskId) {
        try {
            const response = await fetch(`${this.baseURL}/api/quote_items/${taskId}`);
            
            if (!response.ok) {
                throw new Error(`Failed to get task: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('[TaskService] Error getting task by ID:', error);
            throw error;
        }
    }

    /**
     * DELETE: Soft delete task (mark as deleted)
     */
    async deleteTask(taskId) {
        try {
            console.log(`[TaskService] Soft deleting task ${taskId}`);
            
            // Mark as deleted instead of hard delete
            await this.updateTaskCompletion(taskId, {
                completed: false,
                notes: '[DELETED] - Task removed by user'
            });
            
            // Update color to indicate deletion
            const response = await fetch(`${this.baseURL}/api/quote_items/${taskId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    Color: 'Deleted'
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to delete task: ${response.status}`);
            }

            console.log(`[TaskService] Task ${taskId} marked as deleted`);
            return { success: true };
        } catch (error) {
            console.error('[TaskService] Error deleting task:', error);
            throw error;
        }
    }

    /**
     * DELETE: Permanently remove task from database
     */
    async permanentDeleteTask(taskId) {
        try {
            console.log(`[TaskService] Permanently deleting task ${taskId}`);
            
            const response = await fetch(`${this.baseURL}/api/quote_items/${taskId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error(`Failed to permanently delete task: ${response.status}`);
            }

            console.log(`[TaskService] Task ${taskId} permanently deleted`);
            return { success: true };
        } catch (error) {
            console.error('[TaskService] Error permanently deleting task:', error);
            throw error;
        }
    }

    /**
     * READ: Get tasks with advanced filtering
     */
    async getTasksWithFilters(filters = {}) {
        try {
            // Start with all tasks for this user
            let url = `${this.baseURL}/api/quote_items?`;
            
            // Get all quote IDs for this user first
            const sessionsResponse = await fetch(`${this.baseURL}/api/quote_sessions?customerEmail=${this.userEmail}`);
            const sessions = await sessionsResponse.json();
            
            // Filter to task sessions only
            const taskSessions = sessions.filter(s => s.QuoteID && s.QuoteID.startsWith(this.prefix));
            const quoteIds = taskSessions.map(s => s.QuoteID);
            
            if (quoteIds.length === 0) {
                return [];
            }

            // Get all items for these quotes
            const allTasks = [];
            for (const quoteId of quoteIds) {
                const itemsResponse = await fetch(`${this.baseURL}/api/quote_items?quoteID=${quoteId}`);
                const items = await itemsResponse.json();
                
                // Add session data to each item
                const session = taskSessions.find(s => s.QuoteID === quoteId);
                items.forEach(item => {
                    item.SessionDate = session.CreatedAt;
                    item.SessionStatus = session.Status;
                });
                
                allTasks.push(...items);
            }

            // Apply filters
            let filteredTasks = allTasks;

            // Filter by date range
            if (filters.dateFrom) {
                const fromDate = new Date(filters.dateFrom);
                filteredTasks = filteredTasks.filter(task => 
                    new Date(task.SessionDate) >= fromDate
                );
            }

            if (filters.dateTo) {
                const toDate = new Date(filters.dateTo + 'T23:59:59');
                filteredTasks = filteredTasks.filter(task => 
                    new Date(task.SessionDate) <= toDate
                );
            }

            // Filter by task type
            if (filters.taskType) {
                filteredTasks = filteredTasks.filter(task => 
                    task.StyleNumber === filters.taskType.toString()
                );
            }

            // Filter by status
            if (filters.status) {
                if (filters.status === 'completed') {
                    filteredTasks = filteredTasks.filter(task => task.Color === 'Completed');
                } else if (filters.status === 'deleted') {
                    filteredTasks = filteredTasks.filter(task => task.Color === 'Deleted');
                } else if (filters.status === 'active') {
                    filteredTasks = filteredTasks.filter(task => 
                        task.Color !== 'Deleted' && task.Color !== 'Completed'
                    );
                }
            } else {
                // By default, exclude deleted tasks
                filteredTasks = filteredTasks.filter(task => task.Color !== 'Deleted');
            }

            // Sort by date (newest first)
            filteredTasks.sort((a, b) => new Date(b.SessionDate) - new Date(a.SessionDate));

            return filteredTasks;
        } catch (error) {
            console.error('[TaskService] Error getting filtered tasks:', error);
            return [];
        }
    }

    /**
     * UPDATE: Bulk update multiple tasks
     */
    async bulkUpdateTasks(taskIds, updates) {
        try {
            console.log(`[TaskService] Bulk updating ${taskIds.length} tasks:`, updates);
            
            const results = {
                success: [],
                failed: []
            };

            for (const taskId of taskIds) {
                try {
                    await this.updateTaskCompletion(taskId, updates);
                    results.success.push(taskId);
                } catch (error) {
                    results.failed.push({ taskId, error: error.message });
                }
            }

            console.log(`[TaskService] Bulk update completed: ${results.success.length} success, ${results.failed.length} failed`);
            return results;
        } catch (error) {
            console.error('[TaskService] Error in bulk update:', error);
            throw error;
        }
    }

    /**
     * DELETE: Bulk delete multiple tasks
     */
    async bulkDeleteTasks(taskIds) {
        try {
            console.log(`[TaskService] Bulk deleting ${taskIds.length} tasks`);
            
            const results = {
                success: [],
                failed: []
            };

            for (const taskId of taskIds) {
                try {
                    await this.deleteTask(taskId);
                    results.success.push(taskId);
                } catch (error) {
                    results.failed.push({ taskId, error: error.message });
                }
            }

            console.log(`[TaskService] Bulk delete completed: ${results.success.length} success, ${results.failed.length} failed`);
            return results;
        } catch (error) {
            console.error('[TaskService] Error in bulk delete:', error);
            throw error;
        }
    }

    /**
     * UTILITY: Export tasks data to CSV format
     */
    async exportTasksToCSV(filters = {}) {
        try {
            const tasks = await this.getTasksWithFilters(filters);
            
            const csvHeaders = ['Date', 'Task Name', 'Count', 'Time (min)', 'Status', 'Notes'];
            const csvRows = tasks.map(task => {
                let timerData = {};
                try {
                    timerData = JSON.parse(task.TimerData_ || '{}');
                } catch (e) {
                    timerData = {};
                }

                return [
                    new Date(task.SessionDate).toLocaleDateString(),
                    task.ProductName,
                    task.Quantity,
                    Math.round((task.LineTotal || 0) / 60),
                    task.Color,
                    (timerData.notes || '').replace(/"/g, '""') // Escape quotes for CSV
                ];
            });

            const csvContent = [
                csvHeaders.join(','),
                ...csvRows.map(row => row.map(cell => `"${cell}"`).join(','))
            ].join('\n');

            return csvContent;
        } catch (error) {
            console.error('[TaskService] Error exporting to CSV:', error);
            throw error;
        }
    }

    /**
     * Get task data (alias for getTaskById for compatibility)
     */
    async getTaskData(taskId) {
        return await this.getTaskById(taskId);
    }

    /**
     * RESET: Reset task to incomplete state and clear timer data
     */
    async resetTask(taskId) {
        try {
            console.log(`[TaskService] Resetting task ${taskId}`);
            
            // Get current task to preserve basic info
            const currentTask = await this.getTaskById(taskId);
            if (!currentTask) {
                throw new Error('Task not found');
            }

            // Create fresh timer data structure
            const resetTimerData = {
                startTime: null,
                endTime: null,
                totalSeconds: 0,
                totalMinutes: 0,
                taskCount: 0,
                timerSessions: [],
                pauseCount: 0,
                details: {},
                notes: '',
                metadata: {
                    version: '2.1',
                    resetAt: new Date().toISOString(),
                    resetBy: 'user'
                }
            };

            // Reset task to incomplete state
            const resetData = {
                Color: 'In Progress',
                Quantity: 0,
                LineTotal: 0,
                BaseUnitPrice: 0,
                FinalUnitPrice: 0,
                TimerData_: JSON.stringify(resetTimerData)
            };

            const response = await fetch(`${this.baseURL}/api/quote_items/${taskId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(resetData)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to reset task: ${response.status} - ${errorText}`);
            }

            console.log(`[TaskService] Task ${taskId} reset successfully`);
            
            // Update session totals after reset
            await this.updateSessionTotals();
            
            return { success: true };
        } catch (error) {
            console.error('[TaskService] Error resetting task:', error);
            throw error;
        }
    }

    /**
     * Helper: Get end of day timestamp
     */
    getEndOfDay() {
        const end = new Date();
        end.setHours(23, 59, 59, 999);
        return end.toISOString().replace(/\.\d{3}Z$/, '');
    }
}

// Make available globally
window.TaskTrackingService = TaskTrackingService;