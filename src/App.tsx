import { useState, useRef, useEffect } from 'react'
import './App.css'
import { PoseAnalyzer } from './components/PoseAnalyzer'
import { VideoUpload } from './components/VideoUpload'
import { EvaluationResults } from './components/EvaluationResults'
import { SnowboardEvaluator, EvaluationResult } from './utils/snowboardEvaluator'

function App() {
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoUrl, setVideoUrl] = useState<string>('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [evaluationResult, setEvaluationResult] = useState<EvaluationResult | null>(null)
  const [error, setError] = useState<string>('')
  const videoRef = useRef<HTMLVideoElement>(null)

  const handleVideoUpload = (file: File) => {
    setVideoFile(file)
    setVideoUrl(URL.createObjectURL(file))
    setEvaluationResult(null)
    setError('')
  }

  const handleAnalysisComplete = (result: EvaluationResult) => {
    setEvaluationResult(result)
    setIsAnalyzing(false)
  }

  const handleAnalysisError = (errorMsg: string) => {
    setError(errorMsg)
    setIsAnalyzing(false)
  }

  const startAnalysis = () => {
    if (!videoFile) return
    setIsAnalyzing(true)
    setError('')
    setEvaluationResult(null)
  }

  // Clean up video URL when component unmounts
  useEffect(() => {
    return () => {
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl)
      }
    }
  }, [videoUrl])

  return (
    <div className="app">
      <header className="header">
        <h1>🏂 スノーボード動画評価アプリ</h1>
        <p>動画をアップロードして、あなたの滑りを分析・評価します</p>
      </header>

      <VideoUpload onVideoUpload={handleVideoUpload} disabled={isAnalyzing} />

      {videoUrl && (
        <div className="video-section">
          <h2>動画プレビュー</h2>
          <div className="video-container">
            <video
              ref={videoRef}
              src={videoUrl}
              controls
              className="video-player"
            />
          </div>

          {!isAnalyzing && !evaluationResult && (
            <button onClick={startAnalysis} className="upload-button">
              分析を開始
            </button>
          )}
        </div>
      )}

      {isAnalyzing && videoUrl && (
        <>
          <div className="loading">分析中...</div>
          <PoseAnalyzer
            videoUrl={videoUrl}
            onAnalysisComplete={handleAnalysisComplete}
            onError={handleAnalysisError}
          />
        </>
      )}

      {error && (
        <div className="error">
          <strong>エラー:</strong> {error}
          <div style={{ marginTop: '1rem', fontSize: '0.9rem' }}>
            <strong>ヒント:</strong>
            <ul style={{ textAlign: 'left', marginTop: '0.5rem' }}>
              <li>動画に人物の全身が映っていることを確認してください</li>
              <li>動画の解像度が十分高いことを確認してください</li>
              <li>動画ファイルが破損していないか確認してください</li>
              <li>別の動画で試してみてください</li>
              <li>ブラウザのコンソールでより詳細なエラーを確認できます（F12キー）</li>
            </ul>
          </div>
          <button
            onClick={() => setError('')}
            className="upload-button"
            style={{ marginTop: '1rem' }}
          >
            エラーを閉じる
          </button>
        </div>
      )}

      {evaluationResult && (
        <EvaluationResults result={evaluationResult} />
      )}
    </div>
  )
}

export default App
