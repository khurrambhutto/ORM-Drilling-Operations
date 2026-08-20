import React, { useMemo } from 'react';
import { API_BASE } from './config';
import { useAuth } from './auth';

const FiscalYearDisplay = React.memo(({ wellId, wellName, editMode, fiscalYearPlans, onFiscalYearChange }) => {
  const [localPlans, setLocalPlans] = React.useState(fiscalYearPlans || []);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState(null);
  const [saveSuccess, setSaveSuccess] = React.useState(false);
  const originalPlansRef = React.useRef(fiscalYearPlans || []);
  const [newPlanInputs, setNewPlanInputs] = React.useState({}); // { '1st QTR': {WellName, WellDepth, PlanDetails} }
  const { authFetch, isAdmin } = useAuth() || {};

  React.useEffect(() => {
    if (!editMode) {
      setLocalPlans(fiscalYearPlans || []);
      originalPlansRef.current = fiscalYearPlans || [];
    }
  }, [fiscalYearPlans, editMode]);

  React.useEffect(() => {
    if (!editMode) {
      setLoading(true);
      setError(null);
      
      // Always send fy param
      const fy = '2025-26';
      if (wellId && wellId !== 'undefined' && wellId !== 'null') {
        const url = `${API_BASE}/fiscal-year-plans?wellId=${Number(wellId)}&fy=${fy}`;
        console.log('Fetching fiscal year plans with wellId:', wellId, 'URL:', url);
  (authFetch || fetch)(url)
          .then(res => {
            if (!res.ok) throw new Error('Failed to fetch fiscal year plans');
            return res.json();
          })
          .then(data => {
            console.log('Fiscal year plans data:', data);
            setLocalPlans(data);
            setLoading(false);
          })
          .catch(err => {
            console.error('Error fetching fiscal year plans:', err);
            setError(err.message);
            setLocalPlans([
              { QTR: '1st QTR', WellDepth: null, PlanDetails: null },
              { QTR: '2nd QTR', WellDepth: null, PlanDetails: null },
              { QTR: '3rd QTR', WellDepth: null, PlanDetails: null },
              { QTR: '4th QTR', WellDepth: null, PlanDetails: null }
            ]);
            setLoading(false);
          });
      } else if (wellName) {
        const url = `${API_BASE}/fiscal-year-plans?wellName=${encodeURIComponent(wellName)}&fy=${fy}`;
        console.log('Fetching fiscal year plans with wellName:', wellName, 'URL:', url);
  (authFetch || fetch)(url)
          .then(res => {
            if (!res.ok) throw new Error('Failed to fetch fiscal year plans');
            return res.json();
          })
          .then(data => {
            console.log('Fiscal year plans data:', data);
            setLocalPlans(data);
            setLoading(false);
          })
          .catch(err => {
            console.error('Error fetching fiscal year plans:', err);
            setError(err.message);
            setLocalPlans([
              { QTR: '1st QTR', WellDepth: null, PlanDetails: null },
              { QTR: '2nd QTR', WellDepth: null, PlanDetails: null },
              { QTR: '3rd QTR', WellDepth: null, PlanDetails: null },
              { QTR: '4th QTR', WellDepth: null, PlanDetails: null }
            ]);
            setLoading(false);
          });
      } else {
        console.log('No valid wellId or wellName provided');
        setLoading(false);
        setLocalPlans([]);
      }
    } else {
      setLoading(false);
      setError(null);
    }
  }, [wellId, wellName, editMode]);

  // Memoized expensive computations
  const plansByQuarter = useMemo(() => {
    return localPlans.reduce((acc, plan) => {
      if (!acc[plan.QTR]) {
        acc[plan.QTR] = [];
      }
      acc[plan.QTR].push(plan);
      return acc;
    }, {});
  }, [localPlans]);

  const quarters = useMemo(() => ['1st QTR', '2nd QTR', '3rd QTR', '4th QTR'], []);
  const bgColors = useMemo(() => ['#28306e', '#1b3c2e', '#4d3a1a', '#2e1a2f'], []);

  const handleInputChange = (quarter, planIndex, field, value) => {
    const updatedPlans = localPlans.map((plan, idx) => {
      if (plan.QTR === quarter && planIndex === idx) {
        return { ...plan, [field]: value };
      }
      return plan;
    });
    setLocalPlans(updatedPlans);
    if (onFiscalYearChange) onFiscalYearChange(updatedPlans);
  };

  const handleAddPlanInputChange = (quarter, field, value) => {
    setNewPlanInputs(prev => ({
      ...prev,
      [quarter]: {
        ...prev[quarter],
        [field]: value
      }
    }));
  };

  const handleAddPlan = (quarter) => {
    const input = newPlanInputs[quarter] || {};
    // Always use the open well's name and ID from props
    if (!wellName || !wellId) {
      alert('Well context missing!');
      return;
    }
    const newPlan = {
      FY: '2025-26',
      QTR: quarter,
      WellName: wellName, // from props
      WellDepth: input.WellDepth || '',
      PlanDetails: input.PlanDetails || '',
      WellID: parseInt(wellId) // Ensure it's a number, not string
    };
    console.log('Submitting fiscal year plan:', newPlan);
  setSaving(true);
  (authFetch || fetch)(`${API_BASE}/add-fiscal-year-plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newPlan)
    })
      .then(res => {
        if (!res.ok) {
          return res.text().then(text => {
            throw new Error(`HTTP ${res.status}: ${text}`);
          });
        }
        return res.json();
      })
      .then(data => {
        console.log('POST response:', data);
        if (data.error) throw new Error(data.error);
        // Update local state with the new plan
        setLocalPlans(prev => [...prev, data]);
        // Clear the input for this quarter
        setNewPlanInputs(prev => ({ 
          ...prev, 
          [quarter]: { WellDepth: '', PlanDetails: '' } 
        }));
        // Notify parent component if callback exists
        if (onFiscalYearChange) {
          onFiscalYearChange([...localPlans, data]);
        }
        alert('Fiscal year plan added successfully!');
      })
      .catch(err => {
        console.error('Error adding plan:', err);
        setSaveError(err.message);
        alert('Failed to add plan: ' + err.message);
      })
      .finally(() => {
        setSaving(false);
      });
  };

  const handleSave = async () => {
    setSaveSuccess(true);
    // No backend activity, no alert
  };

  const handleCancelEdit = () => {
    setLocalPlans(originalPlansRef.current);
    setSaveError(null);
    setSaveSuccess(false);
    if (onFiscalYearChange) onFiscalYearChange(originalPlansRef.current);
  };

  if (loading) {
    return <div style={{ textAlign: 'center', color: '#fff' }}>Loading fiscal year plans...</div>;
  }

  if (error) {
    return (
      <div style={{ 
        background: '#23234c', 
        color: '#fff', 
        borderRadius: 12, 
        padding: 20, 
        textAlign: 'center' 
      }}>
        <div style={{ color: '#ff6b6b', marginBottom: 8 }}>Error loading fiscal year plans</div>
        <div style={{ fontSize: 14, opacity: 0.8 }}>{error}</div>
      </div>
    );
  }

  return (
    <div style={{ 
      background: '#23234c', 
      color: '#fff', 
      borderRadius: 12, 
      padding: 20, 
      boxShadow: '0 4px 16px rgba(25, 118, 210, 0.10)', 
      border: 'none', 
      fontFamily: 'Inter, Segoe UI, Arial, sans-serif', 
      textAlign: 'center' 
    }}>
      <h4 style={{ 
        margin: '0 0 16px 0', 
        color: '#fff', 
        background: 'transparent', 
        padding: 0, 
        borderRadius: 0, 
        fontSize: '18px', 
        fontWeight: 700, 
        letterSpacing: 0.5, 
        textAlign: 'center' 
      }}>
        F.Y 2025-26
      </h4>
      {/* Save/Cancel buttons in editMode */}
      {editMode && (
        <div style={{ marginBottom: 16, textAlign: 'center' }}>
          <button onClick={handleSave} disabled={saving} style={{ marginRight: 12, background: '#1976d2', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 18px', fontWeight: 700, fontSize: 15, cursor: saving ? 'not-allowed' : 'pointer' }}>Save</button>
          <button onClick={handleCancelEdit} disabled={saving} style={{ background: '#ff8a80', color: '#23234c', border: 'none', borderRadius: 6, padding: '8px 18px', fontWeight: 700, fontSize: 15, cursor: saving ? 'not-allowed' : 'pointer' }}>Cancel</button>
          {saving && <span style={{ marginLeft: 16, color: '#90caf9' }}>Saving...</span>}
          {saveError && <span style={{ marginLeft: 16, color: '#ff8a80' }}>{saveError}</span>}
          {saveSuccess && <span style={{ marginLeft: 16, color: '#43ea7f' }}>Saved!</span>}
        </div>
      )}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(4, 1fr)', 
        gap: 20, 
        justifyContent: 'center' 
      }}>
        {quarters.map((quarter, index) => {
          const quarterPlans = plansByQuarter[quarter] || [];
          return (
            <div key={quarter} style={{ 
              background: bgColors[index], 
              borderRadius: 8, 
              padding: 14, 
              textAlign: 'center', 
              border: 'none',
              minHeight: '120px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center'
            }}>
              <div style={{ 
                fontWeight: 700, 
                marginBottom: 8, 
                fontSize: '16px', 
                color: '#fff' 
              }}>
                {quarter}
              </div>
              {quarterPlans.length > 0 ? (
                <div style={{ fontSize: 14, color: '#fff', fontWeight: 500 }}>
                  {quarterPlans.map((plan, planIndex) => (
                    <div key={planIndex} style={{ marginBottom: planIndex < quarterPlans.length - 1 ? 4 : 0 }}>
                      {editMode ? (
                        <>
                          <input
                            type="text"
                            value={plan.WellName || ''}
                            onChange={e => handleInputChange(quarter, planIndex, 'WellName', e.target.value)}
                            placeholder="Well Name"
                            style={{ width: '90%', marginBottom: 4, borderRadius: 4, border: '1px solid #444', padding: 4, fontSize: 13 }}
                          />
                          <input
                            type="text"
                            value={plan.WellDepth || ''}
                            onChange={e => handleInputChange(quarter, planIndex, 'WellDepth', e.target.value)}
                            placeholder="Well Depth"
                            style={{ width: '90%', marginBottom: 4, borderRadius: 4, border: '1px solid #444', padding: 4, fontSize: 13 }}
                          />
                          <input
                            type="text"
                            value={plan.PlanDetails || ''}
                            onChange={e => handleInputChange(quarter, planIndex, 'PlanDetails', e.target.value)}
                            placeholder="Plan Details"
                            style={{ width: '90%', borderRadius: 4, border: '1px solid #444', padding: 4, fontSize: 12, fontStyle: 'italic' }}
                          />
                        </>
                      ) : (
                        <>
                          {plan.WellName && (
                            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{plan.WellName}</div>
                          )}
                          {plan.WellDepth && (
                            <div style={{ fontWeight: 600 }}>{plan.WellDepth}</div>
                          )}
                          {plan.PlanDetails && (
                            <div style={{ fontSize: 12, opacity: 0.8, fontStyle: 'italic' }}>{plan.PlanDetails}</div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 24, color: '#fff', fontWeight: 700 }}>0</div>
              )}
              {/* Add Plan UI */}
              {editMode && authFetch && (
                <div style={{ marginTop: 10, borderTop: '1px solid #444', paddingTop: 8 }}>
                  <input
                    type="text"
                    placeholder="Well Depth"
                    value={newPlanInputs[quarter]?.WellDepth || ''}
                    onChange={e => handleAddPlanInputChange(quarter, 'WellDepth', e.target.value)}
                    style={{ width: '90%', marginBottom: 4, borderRadius: 4, border: '1px solid #888', padding: 4, fontSize: 13 }}
                  />
                  <input
                    type="text"
                    placeholder="Plan Details"
                    value={newPlanInputs[quarter]?.PlanDetails || ''}
                    onChange={e => handleAddPlanInputChange(quarter, 'PlanDetails', e.target.value)}
                    style={{ width: '90%', marginBottom: 4, borderRadius: 4, border: '1px solid #888', padding: 4, fontSize: 13 }}
                  />
                  <button
                    onClick={() => handleAddPlan(quarter)}
                    disabled={saving}
                    style={{ background: '#43ea7f', color: '#23234c', border: 'none', borderRadius: 6, padding: '6px 14px', fontWeight: 700, fontSize: 14, cursor: saving ? 'not-allowed' : 'pointer', marginTop: 4 }}
                  >
                    Add Plan
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

FiscalYearDisplay.displayName = 'FiscalYearDisplay';

export default FiscalYearDisplay; 