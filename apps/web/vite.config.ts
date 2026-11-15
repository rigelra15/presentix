import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Backend URLs can be changed with env variables, e.g. when the
// services run on other ports. Defaults match the services' defaults.
const employeeApi = process.env.EMPLOYEE_API_URL ?? 'http://127.0.0.1:3000'
const attendanceApi = process.env.ATTENDANCE_API_URL ?? 'http://127.0.0.1:3001'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/employee': {
        target: employeeApi,
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/employee/, '')
      },
      '/api/attendance': {
        target: attendanceApi,
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/attendance/, '')
      }
    }
  },
})
