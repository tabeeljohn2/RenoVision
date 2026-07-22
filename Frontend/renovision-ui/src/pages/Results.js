import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../styles/Results.css';

function Results() {
  const navigate = useNavigate();
  const [results, setResults] = useState(null);
  const [originalImage, setOriginalImage] = useState(null);
  const [activeTab, setActiveTab] = useState('recommendations');

  useEffect(() => {
    const saved = localStorage.getItem('renovisionResults');
    const img   = localStorage.getItem('renovisionImage');
    if (!saved) { navigate('/upload'); return; }
    setResults(JSON.parse(saved));
    setOriginalImage(img);
  }, [navigate]);

  if (!results) return null;

  const { cv_analysis, xai_results, generated_design } = results;
  const normalRecs = xai_results.recommendations.filter(r => !r.is_prompt_based);
  const hasDesign  = generated_design?.success && generated_design?.image_base64;
  const modelUsed  = generated_design?.model_used || '';
  const isLoRA     = modelUsed.toLowerCase().includes('lora');

  return (
    <div className="results-page">

      {/* Navbar */}
      <nav className="navbar">
        <Link to="/home" className="navbar-brand">Reno<span>Vision</span></Link>
        <Link to="/upload" className="btn btn-secondary"
          style={{ fontSize: '0.9rem', padding: '0.5rem 1rem' }}>
          Analyze Another Room
        </Link>
      </nav>

      <div className="page-container">

        {/* Header */}
        <div className="results-header">
          <h1>Your Renovation Plan</h1>
          <p style={{ textTransform: 'capitalize' }}>
            AI analysis complete for your {cv_analysis.room_type}
          </p>
        </div>

        {/* Custom prompt display */}
        {results.user_prompt?.trim() && (
          <div style={{
            background: 'rgba(212,175,55,0.05)',
            border: '1px solid rgba(212,175,55,0.3)',
            borderRadius: '12px', padding: '1rem 1.25rem',
            marginBottom: '1.5rem', borderLeft: '3px solid var(--gold)'
          }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--gold)',
              fontWeight: '700', marginBottom: '0.4rem', letterSpacing: '0.5px' }}>
              ✍️ YOUR CUSTOM REQUEST
            </p>
            <p style={{ fontSize: '0.95rem', color: 'var(--white-soft)', margin: 0 }}>
              {results.user_prompt}
            </p>
          </div>
        )}

        {/* ── Generated Design Image ── */}
        {hasDesign ? (
          <div style={{
            background: 'rgba(212,175,55,0.03)',
            border: '1px solid rgba(212,175,55,0.2)',
            borderRadius: '16px', padding: '1.5rem', marginBottom: '2rem'
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem'
            }}>
              <h2 style={{ color: 'var(--gold)', margin: 0, fontSize: '1.1rem', fontWeight: '700' }}>
                🎨 AI-Generated Renovation Design
              </h2>
              {/* Model badge */}
              <span style={{
                fontSize: '0.72rem', fontWeight: '700', letterSpacing: '0.4px',
                padding: '0.25rem 0.7rem', borderRadius: '20px',
                background: isLoRA ? 'rgba(34,197,94,0.1)' : 'rgba(99,102,241,0.1)',
                color: isLoRA ? '#22c55e' : '#818cf8',
                border: `1px solid ${isLoRA ? 'rgba(34,197,94,0.3)' : 'rgba(99,102,241,0.3)'}`,
              }}>
                {isLoRA ? '🧠 Your LoRA Model' : '🤖 DALL-E 3'}
              </span>
            </div>

            {/* Before / After */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>

              {/* Before */}
              {originalImage && (
                <div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--gray-light)',
                    fontWeight: '700', letterSpacing: '0.5px',
                    marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                    Before
                  </p>
                  <img src={originalImage} alt="Original room"
                    style={{ width: '100%', borderRadius: '10px',
                      border: '1px solid rgba(255,255,255,0.08)', objectFit: 'cover', maxHeight: '320px' }}
                  />
                </div>
              )}

              {/* After */}
              <div>
                <p style={{ fontSize: '0.78rem', color: 'var(--gold)',
                  fontWeight: '700', letterSpacing: '0.5px',
                  marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                  After (AI Redesign)
                </p>
                <img
                  src={`data:image/png;base64,${generated_design.image_base64}`}
                  alt="AI-generated redesign"
                  style={{ width: '100%', borderRadius: '10px',
                    border: '2px solid rgba(212,175,55,0.4)', objectFit: 'cover', maxHeight: '320px' }}
                />
              </div>
            </div>

            {/* Model info row */}
            <div style={{
              marginTop: '1rem', padding: '0.75rem 1rem',
              background: 'rgba(0,0,0,0.2)', borderRadius: '8px',
              fontSize: '0.78rem', color: 'var(--gray-light)',
              display: 'flex', gap: '1.5rem', flexWrap: 'wrap'
            }}>
              <span>
                <strong style={{ color: 'var(--white-soft)' }}>Model: </strong>
                {modelUsed || 'AI Generation'}
              </span>
              {generated_design.prompt_used && (
                <span style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ color: 'var(--white-soft)' }}>Prompt: </strong>
                  <span style={{ opacity: 0.7 }}>
                    {generated_design.prompt_used.slice(0, 100)}...
                  </span>
                </span>
              )}
            </div>

            {/* Download button */}
            <div style={{ marginTop: '0.75rem', textAlign: 'right' }}>
              <a
                href={`data:image/png;base64,${generated_design.image_base64}`}
                download={`renovision_${cv_analysis.room_type}_redesign.png`}
                style={{
                  fontSize: '0.82rem', color: 'var(--gold)',
                  textDecoration: 'none', border: '1px solid rgba(212,175,55,0.4)',
                  padding: '0.3rem 0.9rem', borderRadius: '6px',
                  transition: 'all 0.2s'
                }}
              >
                ⬇ Download Design
              </a>
            </div>
          </div>
        ) : (
          /* Generation failed gracefully */
          generated_design && !generated_design.success && (
            <div style={{
              background: 'rgba(239,68,68,0.05)',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: '12px', padding: '1rem 1.25rem', marginBottom: '1.5rem'
            }}>
              <p style={{ color: '#f87171', margin: 0, fontSize: '0.9rem' }}>
                ⚠️ Image generation unavailable: {generated_design.error}
              </p>
            </div>
          )
        )}

        {/* ── Tabs ── */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {[
            { key: 'recommendations', label: `💡 Recommendations (${normalRecs.length})` },
            { key: 'analysis',        label: '🔍 Room Analysis' },
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '0.5rem 1.1rem', borderRadius: '8px', cursor: 'pointer',
                fontWeight: '600', fontSize: '0.88rem', transition: 'all 0.2s',
                border: activeTab === tab.key
                  ? '1px solid var(--gold)'
                  : '1px solid rgba(255,255,255,0.1)',
                background: activeTab === tab.key
                  ? 'rgba(212,175,55,0.12)'
                  : 'rgba(255,255,255,0.03)',
                color: activeTab === tab.key ? 'var(--gold)' : 'var(--gray-light)',
              }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Recommendations Tab ── */}
        {activeTab === 'recommendations' && (
          <div>
            {/* XAI Summary */}
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <h3 className="section-title">📊 Renovation Summary</h3>
              <p style={{ fontSize: '0.95rem', color: 'var(--white-soft)',
                lineHeight: '1.7', marginBottom: '1rem' }}>
                {xai_results.summary?.summary}
              </p>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                {[
                  { label: 'Budget',  value: `Rs. ${results.budget?.toLocaleString()}` },
                  { label: 'Style',   value: results.style,        capitalize: true },
                  { label: 'Est. Cost', value: `Rs. ${xai_results.summary?.total_estimated_cost?.toLocaleString()}` },
                  { label: 'Within Budget', value: xai_results.summary?.budget_sufficient ? '✅ Yes' : '⚠️ Over' },
                ].map(item => (
                  <div key={item.label} style={{
                    flex: '1 1 120px', padding: '0.75rem 1rem',
                    background: 'rgba(255,255,255,0.04)',
                    borderRadius: '8px', border: '1px solid rgba(255,255,255,0.07)'
                  }}>
                    <p style={{ fontSize: '0.72rem', color: 'var(--gray-light)',
                      marginBottom: '0.2rem', fontWeight: '600', letterSpacing: '0.4px',
                      textTransform: 'uppercase' }}>{item.label}</p>
                    <p style={{ fontSize: '1rem', color: 'var(--white-soft)',
                      fontWeight: '600', textTransform: item.capitalize ? 'capitalize' : 'none' }}>
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Recommendation cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {normalRecs.map((rec, i) => (
                <div key={rec.id || i} className="card" style={{
                  borderLeft: rec.priority === 'High'
                    ? '3px solid #ef4444'
                    : rec.priority === 'Medium'
                    ? '3px solid var(--gold)'
                    : '3px solid #3b82f6'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between',
                    alignItems: 'flex-start', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <h4 style={{ color: 'var(--white-soft)', fontSize: '0.95rem',
                      fontWeight: '600', margin: 0, flex: 1 }}>
                      {rec.recommendation}
                    </h4>
                    <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                      <span style={{
                        fontSize: '0.7rem', fontWeight: '700', padding: '0.15rem 0.55rem',
                        borderRadius: '10px', letterSpacing: '0.3px',
                        background: rec.priority === 'High'
                          ? 'rgba(239,68,68,0.12)'
                          : rec.priority === 'Medium'
                          ? 'rgba(212,175,55,0.12)'
                          : 'rgba(59,130,246,0.12)',
                        color: rec.priority === 'High' ? '#ef4444'
                          : rec.priority === 'Medium' ? 'var(--gold)' : '#60a5fa',
                        border: `1px solid ${rec.priority === 'High'
                          ? 'rgba(239,68,68,0.3)'
                          : rec.priority === 'Medium'
                          ? 'rgba(212,175,55,0.3)'
                          : 'rgba(59,130,246,0.3)'}`,
                      }}>
                        {rec.priority}
                      </span>
                    </div>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--gray-light)',
                    lineHeight: '1.65', margin: '0.6rem 0 0.5rem' }}>
                    {rec.reason}
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'space-between',
                    fontSize: '0.82rem', color: 'var(--gray-light)', flexWrap: 'wrap', gap: '0.4rem' }}>
                    <span>
                      💰 Est. Cost:{' '}
                      <strong style={{ color: 'var(--white-soft)' }}>
                        Rs. {rec.estimated_cost?.toLocaleString()}
                      </strong>
                    </span>
                    <span>
                      Remaining after:{' '}
                      <strong style={{ color: rec.budget_remaining_after >= 0 ? '#22c55e' : '#ef4444' }}>
                        Rs. {rec.budget_remaining_after?.toLocaleString()}
                      </strong>
                    </span>
                  </div>
                </div>
              ))}

              {normalRecs.length === 0 && (
                <div className="card" style={{ textAlign: 'center' }}>
                  <p style={{ color: 'var(--gray-light)' }}>
                    🌟 Your room looks well furnished! No major changes needed.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Analysis Tab ── */}
        {activeTab === 'analysis' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px,1fr))', gap: '1rem' }}>

            {/* Room info */}
            <div className="card">
              <h3 className="section-title">🏠 Room Detection</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {[
                  { label: 'Room Type',   value: cv_analysis.room_type, cap: true },
                  { label: 'Density',     value: cv_analysis.room_density, cap: true },
                  { label: 'Furniture Items', value: cv_analysis.furniture_count },
                  { label: 'Outdoor',     value: cv_analysis.is_outdoor ? 'Yes' : 'No' },
                ].map(row => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between',
                    fontSize: '0.9rem', padding: '0.3rem 0',
                    borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <span style={{ color: 'var(--gray-light)' }}>{row.label}</span>
                    <strong style={{ color: 'var(--white-soft)',
                      textTransform: row.cap ? 'capitalize' : 'none' }}>
                      {row.value}
                    </strong>
                  </div>
                ))}
              </div>
            </div>

            {/* Furniture */}
            {cv_analysis.detected_furniture?.length > 0 && (
              <div className="card">
                <h3 className="section-title">🛋 Detected Furniture</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {cv_analysis.detected_furniture.map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ fontSize: '0.88rem', color: 'var(--white-soft)',
                        textTransform: 'capitalize', minWidth: '100px' }}>
                        {item.item}
                      </span>
                      <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.08)',
                        borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${item.confidence}%`, height: '100%',
                          background: 'var(--gold)', borderRadius: '3px' }} />
                      </div>
                      <span style={{ fontSize: '0.78rem', color: 'var(--gray-light)',
                        minWidth: '36px', textAlign: 'right' }}>
                        {item.confidence}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Colors */}
            <div className="card">
              <h3 className="section-title">🎨 Dominant Colors</h3>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                {cv_analysis.dominant_colors?.map((color, i) => (
                  <div key={i} style={{ textAlign: 'center' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '8px',
                      backgroundColor: color, border: '1px solid rgba(255,255,255,0.12)',
                      marginBottom: '0.3rem' }} />
                    <span style={{ fontSize: '0.7rem', color: 'var(--gray-light)',
                      fontFamily: 'monospace' }}>{color}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Dimensions */}
            {cv_analysis.dimensions && (
              <div className="card">
                <h3 className="section-title">📐 Room Analysis</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {[
                    { label: 'Estimated Size', value: cv_analysis.dimensions.estimated_size },
                    { label: 'Layout',         value: cv_analysis.dimensions.room_width_type },
                    { label: 'Aspect Ratio',   value: cv_analysis.dimensions.aspect_ratio },
                  ].map(row => (
                    <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between',
                      fontSize: '0.9rem', padding: '0.3rem 0',
                      borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <span style={{ color: 'var(--gray-light)' }}>{row.label}</span>
                      <strong style={{ color: 'var(--gold)', textTransform: 'capitalize' }}>
                        {row.value}
                      </strong>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Disclaimer */}
        <div style={{
          background: 'rgba(212,175,55,0.05)',
          border: '1px solid rgba(212,175,55,0.2)',
          borderRadius: '10px', padding: '1rem 1.25rem', marginTop: '2rem'
        }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--gray-light)',
            lineHeight: '1.6', margin: 0 }}>
            ⚠️{' '}
            <strong style={{ color: 'var(--gold)' }}>Advisory Notice:</strong>{' '}
            All renovation recommendations are for planning purposes only. Always consult a qualified
            interior designer or contractor before making actual renovation decisions. Estimated costs are approximate.
          </p>
        </div>

        {/* Actions */}
        <div className="action-buttons">
          <Link to="/upload" className="btn btn-primary">
            Analyze Another Room
          </Link>
        </div>

        {/* Footer */}
        <div style={{
          textAlign: 'center', marginTop: '2rem', padding: '1rem',
          borderTop: '1px solid rgba(212,175,55,0.1)',
          fontSize: '0.85rem', color: 'var(--gray-light)'
        }}>
          RenoVision — Final Year Project | Lahore Garrison University | BSCS 2024
          <br />
          <span style={{ color: 'var(--gold)' }}>Build by Ahmad Raza &amp; Tabeel John</span>
        </div>

      </div>
    </div>
  );
}

export default Results;
