import { useEffect, useRef, useState } from 'react'
import { Pose, Results as PoseResults, POSE_CONNECTIONS } from '@mediapipe/pose'
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils'
import { SnowboardEvaluator, EvaluationResult, PoseFrame } from '../utils/snowboardEvaluator'

interface PoseAnalyzerProps {
  videoUrl: string
  onAnalysisComplete: (result: EvaluationResult) => void
  onError: (error: string) => void
}

export function PoseAnalyzer({ videoUrl, onAnalysisComplete, onError }: PoseAnalyzerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const poseFramesRef = useRef<PoseFrame[]>([])
  const poseRef = useRef<Pose | null>(null)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    let isCancelled = false

    const initializeAndProcess = async () => {
      try {
        console.log('初期化を開始します...')

        // Initialize Pose
        const pose = new Pose({
          locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
          }
        })

        pose.setOptions({
          modelComplexity: 1,
          smoothLandmarks: true,
          enableSegmentation: false,
          smoothSegmentation: false,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        })

        poseRef.current = pose
        console.log('Poseモデルを初期化しました')

        // Wait for model to initialize
        await new Promise(resolve => setTimeout(resolve, 1000))

        if (isCancelled) return

        // Load video
        const video = videoRef.current
        if (!video) {
          throw new Error('動画要素が見つかりません')
        }

        video.src = videoUrl

        // Wait for video metadata to load
        await new Promise<void>((resolve, reject) => {
          video.onloadedmetadata = () => {
            console.log('動画のメタデータを読み込みました:', {
              duration: video.duration,
              width: video.videoWidth,
              height: video.videoHeight
            })
            resolve()
          }
          video.onerror = () => reject(new Error('動画の読み込みに失敗しました'))
          video.load()
        })

        if (isCancelled) return

        // Process video
        await processVideo(pose, video)

        if (isCancelled) return

        // Evaluate results
        console.log('収集したフレーム数:', poseFramesRef.current.length)

        if (poseFramesRef.current.length === 0) {
          throw new Error('姿勢データを検出できませんでした。人物が全身映っている動画を使用してください。')
        }

        const evaluator = new SnowboardEvaluator()
        const result = evaluator.evaluate(poseFramesRef.current)
        onAnalysisComplete(result)

      } catch (err) {
        console.error('分析エラー:', err)
        if (!isCancelled) {
          onError(`${err instanceof Error ? err.message : '動画の分析に失敗しました'}`)
        }
      }
    }

    const processVideo = async (pose: Pose, video: HTMLVideoElement) => {
      poseFramesRef.current = []
      const canvas = canvasRef.current
      if (!canvas) throw new Error('キャンバス要素が見つかりません')

      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('2Dコンテキストの取得に失敗しました')

      // Set canvas size
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight

      const duration = video.duration
      const fps = 5 // Process 5 frames per second for better performance
      const interval = 1 / fps
      const totalFrames = Math.floor(duration * fps)
      let processedFrames = 0

      console.log(`${totalFrames}フレームを処理します (${fps} FPS)`)

      pose.onResults((results: PoseResults) => {
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height)

        // Draw video frame
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

        // Draw pose landmarks
        if (results.poseLandmarks) {
          drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, {
            color: '#00FF00',
            lineWidth: 4
          })
          drawLandmarks(ctx, results.poseLandmarks, {
            color: '#FF0000',
            lineWidth: 2,
            radius: 6
          })

          // Store pose data
          poseFramesRef.current.push({
            timestamp: video.currentTime,
            landmarks: results.poseLandmarks
          })
        }
      })

      // Process frames
      for (let time = 0; time < duration; time += interval) {
        if (isCancelled) break

        video.currentTime = time

        await new Promise<void>((resolve) => {
          const onSeeked = () => {
            video.removeEventListener('seeked', onSeeked)
            resolve()
          }
          video.addEventListener('seeked', onSeeked)
        })

        await pose.send({ image: video })

        processedFrames++
        setProgress(Math.round((processedFrames / totalFrames) * 100))

        // Small delay to prevent blocking
        await new Promise(resolve => setTimeout(resolve, 10))
      }

      console.log('フレーム処理が完了しました')
    }

    initializeAndProcess()

    return () => {
      isCancelled = true
      if (poseRef.current) {
        poseRef.current.close()
        poseRef.current = null
      }
    }
  }, [videoUrl, onAnalysisComplete, onError])

  return (
    <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
      <video
        ref={videoRef}
        style={{ display: 'none' }}
      />
      <canvas
        ref={canvasRef}
        style={{ maxWidth: '100%', border: '2px solid #646cff', borderRadius: '8px' }}
      />
      <div style={{ marginTop: '1rem', fontSize: '1.2rem' }}>
        処理進捗: {progress}%
      </div>
    </div>
  )
}
