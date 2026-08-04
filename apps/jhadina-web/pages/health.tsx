'use client'

/**
 * Health Page - System Status Dashboard
 * 
 * Displays health status of JANET service and other system components.
 * Day 2 implementation focuses on JANET service health only.
 */

import React, { useEffect, useState, useCallback } from 'react'
import type { HealthCheckResponse } from '@/lib/types/janet'
import { janetClient } from '@/lib/janet/client'
import { JanetAPIError, getUserErrorMessage } from '@/lib/errors/janet'

/**
 * Service status badge
 */
function ServiceStatusBadge({
  name,
  status,
  timestamp,
  isLoading,
  error,
  onRetry,
}: {
  name: string
  status: 'ok' | 'error' | null
  timestamp?: string
  isLoading: boolean
  error?: string
  onRetry: () => void
}) {
  return (
    <div className={`status-badge ${status || 'unknown'}`}>
      <div className="badge-header">
        <div className="badge-title">{name}</div>
        <div className="badge-status">
          {isLoading && <span className="status-loading">Checking...</span>}
          {!isLoading && status === 'ok' && (
            <span className="status-ok">✓ Operational</span>
          )}
          {!isLoading && status === 'error' && (
            <span className="status-error">✗ Unavailable</span>
          )}
          {!isLoading && !status && (
            <span className="status-unknown">? Unknown</span>
          )}
        </div>
      </div>

      {error && <div className="badge-error">{error}</div>}

      {timestamp && !isLoading && (
        <div className="badge-timestamp">
          Last checked: {new Date(timestamp).toLocaleTimeString()}
        </div>
      )}

      <button onClick={onRetry} disabled={isLoading} className="btn-check">
        {isLoading ? 'Checking...' : 'Check Now'}
      </button>
    </div>
  )
}

/**
 * System statistics panel
 */
function SystemStats() {
  const [stats, setStats] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const loadStats = async () => {
      setIsLoading(true)

      try {
        const profile = await janetClient.getProfile()
        setStats(profile.stats)
      } catch {
        setStats(null)
      } finally {
        setIsLoading(false)
      }
    }

    loadStats()
  }, [])

  if (isLoading) {
    return <div className="stats-panel loading">Loading statistics...</div>
  }

  if (!stats) {
    return <div className="stats-panel error">Unable to load statistics</div>
  }

  return (
    <div className="stats-panel">
      <h3>Memory Statistics</h3>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.totalMemories}</div>
          <div className="stat-label">Total Memories</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.pendingApprovals}</div>
          <div className="stat-label">Pending Approvals</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.identityMemories}</div>
          <div className="stat-label">Identity Memories</div>
        </div>
      </div>
    </div>
  )
}

/**
 * Main Health Page
 */
export default function HealthPage() {
  const [janetHealth, setJanetHealth] = useState<HealthCheckResponse | null>(
    null
  )
  const [janetError, setJanetError] = useState<string | null>(null)
  const [janetLoading, setJanetLoading] = useState(true)
  const [lastJanetCheck, setLastJanetCheck] = useState<Date | null>(null)

  /**
   * Check JANET service health
   */
  const checkJanetHealth = useCallback(async () => {
    setJanetLoading(true)
    setJanetError(null)

    try {
      const response = await janetClient.getHealth()
      setJanetHealth(response)
      setLastJanetCheck(new Date())
    } catch (err) {
      if (err instanceof JanetAPIError) {
        setJanetError(getUserErrorMessage(err))
      } else {
        setJanetError('Failed to check JANET service health')
      }
      setJanetHealth(null)
    } finally {
      setJanetLoading(false)
    }
  }, [])

  /**
   * Check all services on mount
   */
  useEffect(() => {
    checkJanetHealth()
  }, [checkJanetHealth])

  // Overall system status
  const systemStatus = janetHealth?.status === 'ok' ? 'ok' : 'error'

  return (
    <main className="health-page">
      <header className="page-header">
        <h1>System Health</h1>
        <p>Monitor the status of Jhadina's core services.</p>
      </header>

      <div className="page-content">
        {/* Overall Status */}
        <section className="overview-section">
          <div className={`system-status ${systemStatus}`}>
            <div className="status-icon">
              {systemStatus === 'ok' ? '●' : '●'}
            </div>
            <div className="status-info">
              <h2>
                {systemStatus === 'ok'
                  ? 'All Systems Operational'
                  : 'System Issues Detected'}
              </h2>
              <p>
                {systemStatus === 'ok'
                  ? 'Jhadina is ready to use.'
                  : 'Some services are unavailable. Check below for details.'}
              </p>
            </div>
          </div>
        </section>

        {/* Service Status */}
        <section className="services-section">
          <h3>Services</h3>
          <div className="services-grid">
            <ServiceStatusBadge
              name="JANET Memory"
              status={janetHealth?.status || null}
              timestamp={janetHealth?.timestamp}
              isLoading={janetLoading}
              error={janetError || undefined}
              onRetry={checkJanetHealth}
            />
          </div>
        </section>

        {/* Phase 1A Status */}
        <section className="phase-section">
          <h3>Phase 1.1A Status</h3>
          <div className="phase-info">
            <div className="phase-item completed">
              <span className="phase-icon">✓</span>
              <div>
                <strong>Command Center (Day 1)</strong>
                <p>UI shell with navigation and routing complete</p>
              </div>
            </div>
            <div className="phase-item in-progress">
              <span className="phase-icon">◆</span>
              <div>
                <strong>Memory Approval Loop (Day 2)</strong>
                <p>JANET integration and approval workflow implementation</p>
              </div>
            </div>
            <div className="phase-item planned">
              <span className="phase-icon">○</span>
              <div>
                <strong>Future Phases</strong>
                <p>DELIA, MARISA, Event Bus, Authentication, Audit Trail</p>
              </div>
            </div>
          </div>
        </section>

        {/* Statistics */}
        <section className="stats-section">
          <SystemStats />
        </section>

        {/* Troubleshooting */}
        <section className="troubleshooting-section">
          <h3>Troubleshooting</h3>
          <div className="troubleshooting-content">
            <h4>JANET Service Unavailable?</h4>
            <ol>
              <li>
                Verify JANET is running:
                <code>pnpm dev --filter=@jhadina/janet-memory</code>
              </li>
              <li>
                Check it's listening on port 3001:
                <code>curl http://localhost:3001/health</code>
              </li>
              <li>
                Check logs for errors:
                <code>pnpm logs --filter=@jhadina/janet-memory</code>
              </li>
              <li>Restart the service and try again</li>
            </ol>

            <h4>Memory Approvals Not Working?</h4>
            <ol>
              <li>Ensure JANET service is operational (see above)</li>
              <li>
                Try manually creating a memory via:
                <code>
                  curl -X POST http://localhost:3001/memory/candidate -H
                  "Content-Type: application/json" -d '{"content":"test"}'
                </code>
              </li>
              <li>Check browser console for error messages</li>
              <li>Check network tab in DevTools for failed requests</li>
            </ol>

            <h4>Database Connection Issues?</h4>
            <p>JANET requires PostgreSQL running locally.</p>
            <code>
              postgresql://user:password@localhost:5432/jhadina
            </code>
          </div>
        </section>
      </div>

      <style jsx>{`
        .health-page {
          padding: 2rem;
          max-width: 1200px;
          margin: 0 auto;
          min-height: 100vh;
        }

        .page-header {
          margin-bottom: 2rem;
        }

        .page-header h1 {
          font-size: 2rem;
          margin-bottom: 0.5rem;
        }

        .page-content {
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }

        /* Overview Section */
        .overview-section {
          margin-bottom: 1rem;
        }

        .system-status {
          display: flex;
          align-items: center;
          gap: 1.5rem;
          padding: 2rem;
          border-radius: 8px;
          font-weight: 600;
        }

        .system-status.ok {
          background: #f1f8f4;
          border: 2px solid #4caf50;
          color: #2e7d32;
        }

        .system-status.error {
          background: #ffebee;
          border: 2px solid #f44336;
          color: #c62828;
        }

        .status-icon {
          font-size: 2rem;
          line-height: 1;
        }

        .system-status.ok .status-icon {
          color: #4caf50;
          animation: pulse 2s infinite;
        }

        .system-status.error .status-icon {
          color: #f44336;
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }

        .status-info h2 {
          margin: 0 0 0.25rem 0;
          font-size: 1.3rem;
        }

        .status-info p {
          margin: 0;
          opacity: 0.8;
          font-size: 0.95rem;
        }

        /* Services Section */
        .services-section h3,
        .phase-section h3,
        .stats-section h3,
        .troubleshooting-section h3 {
          margin-top: 0;
          margin-bottom: 1rem;
          font-size: 1.2rem;
        }

        .services-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 1.5rem;
        }

        /* Status Badge */
        .status-badge {
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 1.5rem;
          background: white;
          transition: all 0.2s ease;
        }

        .status-badge.ok {
          border-left: 4px solid #4caf50;
          box-shadow: 0 2px 4px rgba(76, 175, 80, 0.1);
        }

        .status-badge.error {
          border-left: 4px solid #f44336;
          box-shadow: 0 2px 4px rgba(244, 67, 54, 0.1);
        }

        .status-badge.unknown {
          border-left: 4px solid #ff9800;
          box-shadow: 0 2px 4px rgba(255, 152, 0, 0.1);
        }

        .badge-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1rem;
        }

        .badge-title {
          font-weight: 600;
          font-size: 1rem;
        }

        .badge-status {
          text-align: right;
        }

        .status-ok {
          color: #4caf50;
          font-weight: 600;
          font-size: 0.9rem;
        }

        .status-error {
          color: #f44336;
          font-weight: 600;
          font-size: 0.9rem;
        }

        .status-unknown {
          color: #ff9800;
          font-weight: 600;
          font-size: 0.9rem;
        }

        .status-loading {
          color: #1976d2;
          font-size: 0.85rem;
        }

        .badge-error {
          padding: 0.75rem;
          background: #ffebee;
          border: 1px solid #ef5350;
          border-radius: 4px;
          color: #c62828;
          font-size: 0.85rem;
          margin-bottom: 1rem;
        }

        .badge-timestamp {
          font-size: 0.8rem;
          color: #999;
          margin-bottom: 1rem;
        }

        .btn-check {
          width: 100%;
          padding: 0.5rem;
          background: #f5f5f5;
          border: 1px solid #ddd;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.85rem;
          font-weight: 500;
          transition: background 0.2s ease;
        }

        .btn-check:hover:not(:disabled) {
          background: #efefef;
        }

        .btn-check:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Phase Section */
        .phase-info {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .phase-item {
          display: flex;
          gap: 1rem;
          padding: 1rem;
          border-radius: 8px;
          border-left: 4px solid #ddd;
        }

        .phase-item.completed {
          background: #f1f8f4;
          border-left-color: #4caf50;
        }

        .phase-item.in-progress {
          background: #e3f2fd;
          border-left-color: #1976d2;
        }

        .phase-item.planned {
          background: #f5f5f5;
          border-left-color: #999;
        }

        .phase-icon {
          font-size: 1.3rem;
          line-height: 1.2;
          min-width: 1.5rem;
        }

        .phase-item strong {
          display: block;
          margin-bottom: 0.25rem;
        }

        .phase-item p {
          margin: 0;
          font-size: 0.9rem;
          color: #666;
        }

        /* Stats Section */
        .stats-panel {
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 1.5rem;
          background: white;
        }

        .stats-panel.loading,
        .stats-panel.error {
          text-align: center;
          color: #666;
          padding: 2rem;
        }

        .stats-panel h3 {
          margin-top: 0;
          margin-bottom: 1.5rem;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 1rem;
        }

        .stat-card {
          text-align: center;
          padding: 1rem;
          background: #f9f9f9;
          border-radius: 6px;
          border: 1px solid #e0e0e0;
        }

        .stat-value {
          font-size: 1.8rem;
          font-weight: 700;
          color: #1976d2;
          margin-bottom: 0.5rem;
        }

        .stat-label {
          font-size: 0.85rem;
          color: #666;
        }

        /* Troubleshooting Section */
        .troubleshooting-section {
          background: #f9f9f9;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 1.5rem;
        }

        .troubleshooting-content h4 {
          margin-top: 1.5rem;
          margin-bottom: 0.75rem;
          color: #333;
        }

        .troubleshooting-content h4:first-child {
          margin-top: 0;
        }

        .troubleshooting-content ol {
          margin: 0 0 1rem 1.5rem;
          padding: 0;
        }

        .troubleshooting-content li {
          margin-bottom: 0.5rem;
        }

        .troubleshooting-content code {
          display: inline-block;
          background: white;
          border: 1px solid #ddd;
          border-radius: 3px;
          padding: 0.2rem 0.4rem;
          font-family: monospace;
          font-size: 0.85rem;
          color: #c62828;
          margin: 0.25rem 0;
        }

        .troubleshooting-content p {
          color: #666;
          margin: 0.5rem 0;
        }

        /* Responsive */
        @media (max-width: 768px) {
          .health-page {
            padding: 1rem;
          }

          .page-header h1 {
            font-size: 1.5rem;
          }

          .system-status {
            flex-direction: column;
            text-align: center;
          }

          .status-info h2 {
            font-size: 1.1rem;
          }

          .services-grid {
            grid-template-columns: 1fr;
          }

          .badge-header {
            flex-direction: column;
            gap: 0.5rem;
          }

          .badge-status {
            text-align: left;
          }
        }
      `}</style>
    </main>
  )
}
