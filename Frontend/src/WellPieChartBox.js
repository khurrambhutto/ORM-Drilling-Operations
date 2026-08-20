import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

function WellPieChartBox({ well }) {
  if (!well) return null;
  return (
    <div className="well-chart-container" style={{ 
      minWidth: 300, 
      margin: '0 auto',
      textAlign: 'center',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <h3 style={{ 
        color: '#fff', 
        marginBottom: 12, 
        fontWeight: 700, 
        fontSize: 18,
        textAlign: 'center'
      }}>
        {well.WellName} - Target vs Actual Depth
      </h3>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <ResponsiveContainer width={260} height={260}>
          <PieChart>
            <Pie
              data={[
                { name: 'Actual Depth', value: well.PresentDepthM },
                { name: 'Target Depth Remaining', value: Math.max(well.TDM - well.PresentDepthM, 0) }
              ]}
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
      </div>
      <div style={{ 
        marginTop: 12, 
        fontWeight: 600, 
        fontSize: 16,
        textAlign: 'center'
      }}>
        {well.BlockName}
      </div>
      <div style={{ 
        fontSize: 15, 
        opacity: 0.7, 
        marginTop: 4, 
        fontStyle: 'italic',
        textAlign: 'center'
      }}>
        {well.PlanDetails}
      </div>
    </div>
  );
}

export default WellPieChartBox; 