import React, { Suspense } from 'react';
const { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } = require('recharts');

function WellCharts({ pieChartData, barChartData, testBarChartData }) {
  return (
    <div style={{ margin: '40px 0', display: 'flex', gap: 32, justifyContent: 'center', flexWrap: 'wrap' }}>
      {/* Pie Chart: Target vs Actual Depth */}
  <div style={{ background: '#23234c', borderRadius: 12, padding: 20, minWidth: 300, textAlign: 'center', border: '1px solid rgba(42,91,215,0.4)' }}>
        <h4 style={{ color: '#fff', marginBottom: 12, fontWeight: 700, fontSize: 18, textAlign: 'center' }}>Target vs Actual Depth</h4>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Suspense fallback={<div>Loading chart...</div>}>
            <ResponsiveContainer width={260} height={260}>
              <PieChart>
                <Pie
                  data={pieChartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                >
                  <Cell fill="#1976d2" />
                  <Cell fill="#90caf9" />
                </Pie>
                <Tooltip contentStyle={{ background: '#23234c', color: '#fff', border: 'none' }} />
                <Legend iconType="circle" wrapperStyle={{ color: '#fff' }} />
              </PieChart>
            </ResponsiveContainer>
          </Suspense>
        </div>
      </div>
      {/* Bar Chart: Drlg Plan vs Dry */}
  <div style={{ background: '#23234c', borderRadius: 12, padding: 20, minWidth: 300, textAlign: 'center', border: '1px solid rgba(42,91,215,0.4)' }}>
        <h4 style={{ color: '#fff', marginBottom: 12, fontWeight: 700, fontSize: 18, textAlign: 'center' }}>Drlg Plan vs Dry</h4>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Suspense fallback={<div>Loading chart...</div>}>
            <ResponsiveContainer width={260} height={260}>
              <BarChart data={barChartData} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                <XAxis dataKey="name" stroke="#fff" tick={{ fill: '#fff', fontSize: 18 }} />
                <YAxis stroke="#fff" tick={{ fill: '#fff', fontSize: 18 }} />
                <Tooltip contentStyle={{ background: '#23234c', color: '#fff', border: 'none' }} />
                <Legend iconType="circle" wrapperStyle={{ color: '#fff' }} />
                <Bar dataKey="Drlg Plan" fill="#1976d2" barSize={32} />
                <Bar dataKey="Dry" fill="#ff8a80" barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </Suspense>
        </div>
      </div>
    </div>
  );
}

export default WellCharts; 