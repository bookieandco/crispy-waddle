'use client'

/**
 * Approvals Page - Day 2 Implementation
 * 
 * Dedicated interface for reviewing and managing memory approvals.
 * Shows pending memories with decision workflow.
 */

import React, { useEffect, useState, useCallback } from 'react'
import type { MemoryCandidate } from '@/lib/janet'
import { getJanetErrorMessage, JanetApiError, janetClient } from '@/lib/janet'

/**
 * Approval workflow component
 */
function ApprovalWorkflow({
  memory,
  onApprove,
  isProcessing,
}: {
  memory: MemoryCandidate
  onApprove: (id: string) => Promise<void>
  isProcessing: boolean
}) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isComplete, setIsComplete] = useState(false)

  const handleApprove = async () => {
    setIsLoading(true)
    setError(null)

    try {
      await onApprove(memory.id)
      setIsComplete(true)

      // Reset after 2 seconds
      setTimeout(() => {
        setIsComplete(false)
      }, 2000)
    } catch (err) {
      if (err instanceof JanetApiError) {
        setError(getJanetErrorMessage(err))
      } else {
        setError('Failed to process approval')
      }
    } finally {
      setIsLoading(false)
    }
  }

  if (isComplete) {
    return (
      <div className="approval-result success">
        <div className="result-icon">✓</div>
        <div className="result-text">Memory approved and saved</div>
        <div className="result-timestamp">
          {new Date().toLocaleTimeString()}
        </div>
      </div>
    )
  }

  return (
    <div className="approval-workflow">
      {error && (
        <div className="approval-error">
          <strong>Error:</strong> {error}
        </div>
      )}

      <div className="workflow-steps">
        <div className="step">
          <div className="step-number">1</div>
          <div className="step-content">
            <h4>Review Information</h4>
            <p className="step-text">{memory.content || 'No candidate content provided.'}</p>
          </div>
        </div>

        <div className="step">
          <div className="step-number">2</div>
          <div className="step-content">
            <h4>Classification</h4>
            <div className="classification">
              <span className="type-badge">{memory.type}</span>
              <span className="confidence-score">
                {typeof memory.confidence === 'number'
                  ? `${(memory.confidence * 100).toFixed(0)}% confidence`
                  : 'Confidence unavailable'}
              </span>
            </div>
            {memory.reasoning && <p className="step-text">{memory.reasoning}</p>}
          </div>
        </div>

        <div className="step">
          <div className="step-number">3</div>
          <div className="step-content">
            <h4>Your Decision</h4>
            <button
              onClick={handleApprove}
              disabled={isLoading || isProcessing}
              className="btn-approve-primary"
            >
              {isLoading ? 'Processing...' : 'Approve and Save'}
            </button>
          </div>
        </div>
      </div>

      <div className="approval-note">
        <small>
          Approved memories are stored and can be searched and retrieved by the system.
          You can view your complete approval history in the timeline.
        </small>
      </div>
    </div>
  )
}

/**
 * Main Approvals Page
 */
export default function ApprovalsPage() {
  const [memories, setMemories] = useState<MemoryCandidate[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isApproving, setIsApproving] = useState(false)

  /**
   * Load pending memories
   */
  const loadPendingMemories = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const pending = await janetClient.getPendingMemories()
      setMemories(pending)
      setCurrentIndex(0)
    } catch (err) {
      if (err instanceof JanetApiError) {
        setError(getJanetErrorMessage(err))
      } else {
        setError('Failed to load pending memories')
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Handle approval and move to next
   */
  const handleApprove = useCallback(
    async (memoryId: string) => {
      setIsApproving(true)

      try {
        await janetClient.approveMemory(memoryId)

        // Remove from list and move to next
        const newMemories = memories.filter(m => m.id !== memoryId)
        setMemories(newMemories)

        // Adjust index if needed
        if (currentIndex >= newMemories.length && currentIndex > 0) {
          setCurrentIndex(currentIndex - 1)
        }
      } finally {
        setIsApproving(false)
      }
    },
    [memories, currentIndex]
  )

  /**
   * Navigate to previous
   */
  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
    }
  }

  /**
   * Navigate to next
   */
  const handleNext = () => {
    if (currentIndex < memories.length - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }

  /**
   * Load on mount
   */
  useEffect(() => {
    loadPendingMemories()
  }, [loadPendingMemories])

  const currentMemory = memories[currentIndex]
  const hasMore = currentIndex < memories.length - 1
  const hasPrevious = currentIndex > 0

  return (
    <main className="approvals-page">
      <header className="page-header">
        <h1>Approval Workflow</h1>
        <p>Review and approve each memory to build your knowledge base.</p>
      </header>

      <div className="page-content">
        {isLoading && (
          <div className="state-loading">
            <p>Loading pending approvals...</p>
          </div>
        )}

        {error && (
          <div className="state-error">
            <p>{error}</p>
            <button onClick={loadPendingMemories} className="btn-retry">
              Try Again
            </button>
          </div>
        )}

        {!isLoading && !error && memories.length === 0 && (
          <div className="state-empty">
            <div className="empty-icon">✓</div>
            <h2>All Caught Up!</h2>
            <p>No pending memories to approve.</p>
          </div>
        )}

        {!isLoading && !error && memories.length > 0 && (
          <div className="approval-container">
            {/* Progress */}
            <div className="progress-bar">
              <div className="progress-info">
                <span className="progress-count">
                  {currentIndex + 1} of {memories.length}
                </span>
                <span className="progress-text">
                  {memories.length} pending {memories.length === 1 ? 'approval' : 'approvals'}
                </span>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{
                    width: `${((currentIndex + 1) / memories.length) * 100}%`,
                  }}
                ></div>
              </div>
            </div>

            {/* Current Memory */}
            {currentMemory && (
              <div className="approval-main">
                <ApprovalWorkflow
                  memory={currentMemory}
                  onApprove={handleApprove}
                  isProcessing={isApproving}
                />
              </div>
            )}

            {/* Navigation */}
            <div className="approval-navigation">
              <button
                onClick={handlePrevious}
                disabled={!hasPrevious}
                className="btn-nav"
              >
                ← Previous
              </button>

              <div className="nav-dots">
                {memories.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentIndex(index)}
                    className={`dot ${index === currentIndex ? 'active' : ''}`}
                    aria-label={`Go to memory ${index + 1}`}
                  />
                ))}
              </div>

              <button
                onClick={handleNext}
                disabled={!hasMore}
                className="btn-nav"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .approvals-page {
          padding: 2rem;
          max-width: 900px;
          margin: 0 auto;
          min-height: 100vh;
        }

        .page-header {
          margin-bottom: 2rem;
          text-align: center;
        }

        .page-header h1 {
          font-size: 2rem;
          margin-bottom: 0.5rem;
        }

        .page-header p {
          color: #666;
          font-size: 1.05rem;
        }

        .page-content {
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          padding: 2rem;
        }

        /* States */
        .state-loading,
        .state-error,
        .state-empty {
          text-align: center;
          padding: 3rem 2rem;
        }

        .state-empty {
          padding: 4rem 2rem;
        }

        .empty-icon {
          font-size: 3rem;
          margin-bottom: 1rem;
        }

        .state-empty h2 {
          font-size: 1.5rem;
          margin-bottom: 0.5rem;
        }

        .state-empty p {
          color: #666;
        }

        .state-error {
          background: #ffebee;
          border: 1px solid #ef5350;
          border-radius: 8px;
          color: #c62828;
        }

        .btn-retry {
          margin-top: 1rem;
          padding: 0.75rem 1.5rem;
          background: #c62828;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 600;
        }

        .btn-retry:hover {
          background: #b71c1c;
        }

        /* Approval Container */
        .approval-container {
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }

        /* Progress Bar */
        .progress-bar {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .progress-info {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .progress-count {
          font-size: 0.9rem;
          font-weight: 600;
          color: #333;
        }

        .progress-text {
          font-size: 0.85rem;
          color: #666;
        }

        .progress-track {
          width: 100%;
          height: 6px;
          background: #e0e0e0;
          border-radius: 3px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #4caf50, #45a049);
          transition: width 0.3s ease;
        }

        /* Approval Workflow */
        .approval-workflow {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .approval-error {
          padding: 1rem;
          background: #ffebee;
          border-left: 4px solid #f44336;
          border-radius: 4px;
          color: #c62828;
          font-size: 0.9rem;
        }

        .workflow-steps {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .step {
          display: flex;
          gap: 1.5rem;
          padding: 1.5rem;
          background: #f5f5f5;
          border-radius: 8px;
          border-left: 4px solid #1976d2;
        }

        .step-number {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          background: #1976d2;
          color: white;
          border-radius: 50%;
          font-weight: 700;
          flex-shrink: 0;
        }

        .step-content {
          flex: 1;
        }

        .step-content h4 {
          margin: 0 0 0.5rem 0;
          font-size: 1.05rem;
          color: #333;
        }

        .step-text {
          margin: 0;
          color: #666;
          line-height: 1.5;
        }

        .classification {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-top: 0.5rem;
        }

        .type-badge {
          display: inline-block;
          padding: 0.4rem 0.8rem;
          background: #e3f2fd;
          color: #1976d2;
          border-radius: 4px;
          font-weight: 600;
          font-size: 0.9rem;
        }

        .confidence-score {
          color: #666;
          font-size: 0.9rem;
        }

        .btn-approve-primary {
          padding: 0.75rem 2rem;
          background: #4caf50;
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s ease;
          min-width: 200px;
        }

        .btn-approve-primary:hover:not(:disabled) {
          background: #45a049;
        }

        .btn-approve-primary:disabled {
          background: #bdbdbd;
          cursor: not-allowed;
        }

        .approval-note {
          padding: 1rem;
          background: #f9f9f9;
          border-radius: 4px;
          border-left: 4px solid #ff9800;
          color: #666;
        }

        /* Approval Result */
        .approval-result {
          padding: 2rem;
          border-radius: 8px;
          text-align: center;
          animation: slideIn 0.3s ease;
        }

        .approval-result.success {
          background: #f1f8f4;
          border: 2px solid #4caf50;
        }

        .result-icon {
          font-size: 2.5rem;
          color: #4caf50;
          margin-bottom: 0.5rem;
        }

        .result-text {
          font-size: 1.1rem;
          font-weight: 600;
          color: #333;
          margin-bottom: 0.25rem;
        }

        .result-timestamp {
          font-size: 0.85rem;
          color: #666;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Navigation */
        .approval-navigation {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          padding-top: 1rem;
          border-top: 1px solid #e0e0e0;
        }

        .btn-nav {
          padding: 0.5rem 1rem;
          background: #f5f5f5;
          border: 1px solid #ddd;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s ease;
        }

        .btn-nav:hover:not(:disabled) {
          background: #efefef;
          border-color: #bbb;
        }

        .btn-nav:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .nav-dots {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          flex-wrap: wrap;
          flex: 1;
        }

        .dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          border: 2px solid #ddd;
          background: white;
          cursor: pointer;
          transition: all 0.2s ease;
          padding: 0;
        }

        .dot:hover {
          border-color: #999;
        }

        .dot.active {
          background: #1976d2;
          border-color: #1976d2;
        }

        /* Responsive */
        @media (max-width: 768px) {
          .approvals-page {
            padding: 1rem;
          }

          .page-content {
            padding: 1.5rem;
          }

          .page-header h1 {
            font-size: 1.5rem;
          }

          .step {
            flex-direction: column;
            gap: 1rem;
          }

          .step-number {
            width: 35px;
            height: 35px;
            font-size: 0.9rem;
          }

          .approval-navigation {
            flex-direction: column;
          }

          .btn-nav {
            width: 100%;
          }

          .nav-dots {
            width: 100%;
          }
        }
      `}</style>
    </main>
  )
}
