'use client'

/**
 * Memory Page - Day 2 Implementation
 * 
 * Displays pending memory candidates and allows user approval.
 * 
 * Workflow:
 * 1. Load pending memories from JANET
 * 2. Display with confidence scores and classification
 * 3. User approves individual memories
 * 4. Refresh queue after approval
 * 5. Show success/error feedback
 */

import React, { useEffect, useState, useCallback } from 'react'
import type { Memory, HealthCheckResponse } from '@/lib/types/janet'
import { janetClient } from '@/lib/janet/client'
import { JanetAPIError, getUserErrorMessage } from '@/lib/errors/janet'

/**
 * Memory card component for displaying a single pending memory
 */
function MemoryCard({
  memory,
  onApprove,
  isApproving,
}: {
  memory: Memory
  onApprove: (id: string) => Promise<void>
  isApproving: boolean
}) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isApproved, setIsApproved] = useState(false)

  const handleApprove = async () => {
    setIsLoading(true)
    setError(null)

    try {
      await onApprove(memory.id)
      setIsApproved(true)
    } catch (err) {
      if (err instanceof JanetAPIError) {
        setError(getUserErrorMessage(err))
      } else {
        setError('Failed to approve memory')
      }
    } finally {
      setIsLoading(false)
    }
  }

  if (isApproved) {
    return (
      <div className="memory-card approved">
        <div className="card-status">✓ Approved</div>
        <div className="card-content">{memory.content}</div>
      </div>
    )
  }

  return (
    <div className="memory-card pending">
      <div className="card-header">
        <span className="memory-type">{memory.type}</span>
        <span className="confidence">
          {(memory.confidence * 100).toFixed(0)}% confident
        </span>
      </div>

      <div className="card-content">{memory.content}</div>

      {memory.createdAt && (
        <div className="card-metadata">
          <small>
            Created {new Date(memory.createdAt).toLocaleString()}
          </small>
        </div>
      )}

      {error && <div className="card-error">{error}</div>}

      <div className="card-actions">
        <button
          onClick={handleApprove}
          disabled={isLoading || isApproving}
          className="btn-approve"
        >
          {isLoading ? 'Approving...' : 'Approve'}
        </button>
      </div>
    </div>
  )
}

/**
 * Health indicator showing JANET service status
 */
function HealthIndicator() {
  const [health, setHealth] = useState<HealthCheckResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const checkHealth = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await janetClient.getHealth()
      setHealth(response)
    } catch (err) {
      if (err instanceof JanetAPIError) {
        setError(getUserErrorMessage(err))
      } else {
        setError('Failed to check service health')
      }
      setHealth(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    checkHealth()
  }, [checkHealth])

  const statusClass = health?.status === 'ok' ? 'connected' : 'offline'

  return (
    <div className={`health-indicator ${statusClass}`}>
      <div className="status-dot"></div>
      <div className="status-text">
        {isLoading && 'Checking...'}
        {!isLoading && health?.status === 'ok' && 'Connected'}
        {!isLoading && health?.status !== 'ok' && 'Offline'}
        {error && !isLoading && 'Error'}
      </div>
      <button
        onClick={checkHealth}
        disabled={isLoading}
        className="btn-refresh"
      >
        Refresh
      </button>
    </div>
  )
}

/**
 * User profile summary
 */
function ProfileSummary() {
  const [profile, setProfile] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadProfile = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const data = await janetClient.getProfile()
        setProfile(data)
      } catch (err) {
        if (err instanceof JanetAPIError) {
          setError(getUserErrorMessage(err))
        } else {
          setError('Failed to load profile')
        }
      } finally {
        setIsLoading(false)
      }
    }

    loadProfile()
  }, [])

  if (isLoading) return <div className="profile-summary loading">Loading profile...</div>
  if (error) return <div className="profile-summary error">{error}</div>
  if (!profile) return null

  return (
    <div className="profile-summary">
      <h3>Your Profile</h3>
      <dl>
        <dt>User</dt>
        <dd>{profile.userId}</dd>
        <dt>Total Memories</dt>
        <dd>{profile.stats.totalMemories}</dd>
        <dt>Pending Approvals</dt>
        <dd>{profile.stats.pendingApprovals}</dd>
        <dt>Identity Memories</dt>
        <dd>{profile.stats.identityMemories}</dd>
      </dl>
    </div>
  )
}

/**
 * Main Memory Page Component
 */
export default function MemoryPage() {
  const [memories, setMemories] = useState<Memory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isApproving, setIsApproving] = useState(false)

  /**
   * Load pending memories from JANET
   */
  const loadPendingMemories = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const pending = await janetClient.getPendingMemories()
      setMemories(pending)
    } catch (err) {
      if (err instanceof JanetAPIError) {
        setError(getUserErrorMessage(err))
      } else {
        setError('Failed to load pending memories')
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Handle memory approval
   */
  const handleApprove = useCallback(
    async (memoryId: string) => {
      setIsApproving(true)

      try {
        await janetClient.approveMemory(memoryId)
        // Remove approved memory from the list
        setMemories(prev => prev.filter(m => m.id !== memoryId))
      } finally {
        setIsApproving(false)
      }
    },
    []
  )

  /**
   * Load memories on mount
   */
  useEffect(() => {
    loadPendingMemories()
  }, [loadPendingMemories])

  return (
    <main className="memory-page">
      <header className="page-header">
        <h1>Memory Approval Queue</h1>
        <p>Review and approve your memories to build your personal knowledge base.</p>
      </header>

      <div className="page-content">
        {/* Health Status */}
        <section className="health-section">
          <HealthIndicator />
        </section>

        {/* Profile Summary */}
        <section className="profile-section">
          <ProfileSummary />
        </section>

        {/* Main Content */}
        <section className="memory-section">
          {isLoading && (
            <div className="state-loading">
              <p>Loading pending memories...</p>
            </div>
          )}

          {error && (
            <div className="state-error">
              <p>{error}</p>
              <button onClick={loadPendingMemories} className="btn-retry">
                Retry
              </button>
            </div>
          )}

          {!isLoading && !error && memories.length === 0 && (
            <div className="state-empty">
              <p>No pending memories. All caught up!</p>
            </div>
          )}

          {!isLoading && !error && memories.length > 0 && (
            <div className="memory-list">
              <h2>
                {memories.length} Pending{' '}
                {memories.length === 1 ? 'Memory' : 'Memories'}
              </h2>
              <div className="cards-grid">
                {memories.map(memory => (
                  <MemoryCard
                    key={memory.id}
                    memory={memory}
                    onApprove={handleApprove}
                    isApproving={isApproving}
                  />
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      <style jsx>{`
        .memory-page {
          padding: 2rem;
          max-width: 1200px;
          margin: 0 auto;
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

        /* Health Section */
        .health-section {
          margin-bottom: 1rem;
        }

        .health-indicator {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1rem;
          border: 1px solid #ddd;
          border-radius: 8px;
          background: #f9f9f9;
        }

        .health-indicator.connected {
          border-color: #4caf50;
          background: #f1f8f4;
        }

        .health-indicator.offline {
          border-color: #f44336;
          background: #fef1f0;
        }

        .status-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #999;
        }

        .health-indicator.connected .status-dot {
          background: #4caf50;
          animation: pulse 2s infinite;
        }

        .health-indicator.offline .status-dot {
          background: #f44336;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .status-text {
          flex: 1;
          font-size: 0.9rem;
          font-weight: 500;
        }

        .btn-refresh {
          padding: 0.5rem 1rem;
          background: #fff;
          border: 1px solid #ddd;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.85rem;
        }

        .btn-refresh:hover:not(:disabled) {
          background: #f0f0f0;
        }

        .btn-refresh:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Profile Section */
        .profile-section {
          margin-bottom: 2rem;
        }

        .profile-summary {
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 1.5rem;
          background: #fafafa;
        }

        .profile-summary.loading,
        .profile-summary.error {
          padding: 2rem;
          text-align: center;
          color: #666;
        }

        .profile-summary h3 {
          margin-top: 0;
          margin-bottom: 1rem;
        }

        .profile-summary dl {
          display: grid;
          grid-template-columns: 150px 1fr;
          gap: 0.5rem 1rem;
          margin: 0;
        }

        .profile-summary dt {
          font-weight: 600;
          color: #333;
        }

        .profile-summary dd {
          margin: 0;
          color: #666;
        }

        /* Memory Section */
        .memory-section {
          flex: 1;
        }

        .memory-list h2 {
          margin-top: 0;
          margin-bottom: 1.5rem;
        }

        .cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
          gap: 1.5rem;
        }

        /* Memory Card */
        .memory-card {
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 1.5rem;
          background: #fff;
          transition: all 0.2s ease;
        }

        .memory-card.pending {
          border-left: 4px solid #ff9800;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .memory-card.pending:hover {
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
        }

        .memory-card.approved {
          border-left: 4px solid #4caf50;
          background: #f1f8f4;
          opacity: 0.7;
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
          gap: 1rem;
        }

        .memory-type {
          display: inline-block;
          padding: 0.25rem 0.75rem;
          background: #e3f2fd;
          color: #1976d2;
          border-radius: 4px;
          font-size: 0.85rem;
          font-weight: 600;
        }

        .confidence {
          font-size: 0.85rem;
          color: #666;
          white-space: nowrap;
        }

        .card-status {
          padding: 0.5rem 1rem;
          background: #4caf50;
          color: white;
          border-radius: 4px;
          font-size: 0.9rem;
          margin-bottom: 1rem;
        }

        .card-content {
          font-size: 1rem;
          line-height: 1.5;
          margin-bottom: 1rem;
          color: #333;
        }

        .card-metadata {
          margin-bottom: 1rem;
          color: #999;
        }

        .card-error {
          padding: 0.75rem;
          background: #ffebee;
          border: 1px solid #ef5350;
          border-radius: 4px;
          color: #c62828;
          font-size: 0.85rem;
          margin-bottom: 1rem;
        }

        .card-actions {
          display: flex;
          gap: 0.75rem;
        }

        .btn-approve {
          flex: 1;
          padding: 0.75rem 1rem;
          background: #4caf50;
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s ease;
        }

        .btn-approve:hover:not(:disabled) {
          background: #45a049;
        }

        .btn-approve:disabled {
          background: #bdbdbd;
          cursor: not-allowed;
        }

        /* States */
        .state-loading,
        .state-error,
        .state-empty {
          text-align: center;
          padding: 3rem 2rem;
          background: #f5f5f5;
          border-radius: 8px;
        }

        .state-empty {
          color: #666;
        }

        .state-error {
          background: #ffebee;
          color: #c62828;
          border: 1px solid #ef5350;
        }

        .btn-retry {
          margin-top: 1rem;
          padding: 0.75rem 1.5rem;
          background: #c62828;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }

        .btn-retry:hover {
          background: #b71c1c;
        }

        /* Responsive */
        @media (max-width: 768px) {
          .memory-page {
            padding: 1rem;
          }

          .page-header h1 {
            font-size: 1.5rem;
          }

          .cards-grid {
            grid-template-columns: 1fr;
          }

          .card-header {
            flex-direction: column;
            align-items: flex-start;
          }
        }
      `}</style>
    </main>
  )
}
