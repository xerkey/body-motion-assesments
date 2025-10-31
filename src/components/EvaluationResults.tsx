import { EvaluationResult } from '../utils/snowboardEvaluator'

interface EvaluationResultsProps {
  result: EvaluationResult
}

export function EvaluationResults({ result }: EvaluationResultsProps) {
  const getScoreColor = (score: number): string => {
    if (score >= 80) return '#4CAF50'
    if (score >= 60) return '#FFC107'
    return '#F44336'
  }

  const getGrade = (score: number): string => {
    if (score >= 90) return 'S'
    if (score >= 80) return 'A'
    if (score >= 70) return 'B'
    if (score >= 60) return 'C'
    if (score >= 50) return 'D'
    return 'E'
  }

  return (
    <div className="results">
      <h2>評価結果</h2>

      <div className="score-card">
        <h3>総合評価</h3>
        <div
          className="score-value"
          style={{ color: getScoreColor(result.overallScore) }}
        >
          {result.overallScore} / 100
        </div>
        <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>
          グレード: {getGrade(result.overallScore)}
        </div>
      </div>

      <div className="score-details">
        <div className="detail-item">
          <strong>バランス</strong>
          <div style={{ fontSize: '1.5rem', color: getScoreColor(result.balanceScore) }}>
            {result.balanceScore} / 100
          </div>
        </div>

        <div className="detail-item">
          <strong>姿勢</strong>
          <div style={{ fontSize: '1.5rem', color: getScoreColor(result.postureScore) }}>
            {result.postureScore} / 100
          </div>
        </div>

        <div className="detail-item">
          <strong>滑らかさ</strong>
          <div style={{ fontSize: '1.5rem', color: getScoreColor(result.smoothnessScore) }}>
            {result.smoothnessScore} / 100
          </div>
        </div>

        <div className="detail-item">
          <strong>エッジコントロール</strong>
          <div style={{ fontSize: '1.5rem', color: getScoreColor(result.edgeControlScore) }}>
            {result.edgeControlScore} / 100
          </div>
        </div>
      </div>

      <div className="feedback">
        <h4>改善ポイント</h4>
        <ul>
          {result.feedback.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      </div>

      <div className="score-details" style={{ marginTop: '1.5rem' }}>
        <div className="detail-item">
          <strong>体の安定性</strong>
          <div>{result.details.posturalStability.toFixed(1)}%</div>
        </div>

        <div className="detail-item">
          <strong>膝の角度</strong>
          <div>{result.details.kneeFlexion.toFixed(1)}°</div>
        </div>

        <div className="detail-item">
          <strong>動きの変動</strong>
          <div>{result.details.movementVariation.toFixed(2)}</div>
        </div>
      </div>
    </div>
  )
}
