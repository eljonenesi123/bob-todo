import { createContext, useContext } from 'react'

export const TasksContext = createContext(null)

// Shared task data: one fetch + one live-sync channel for every screen
export const useTaskData = () => useContext(TasksContext)
