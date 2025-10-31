import { useEffect, useRef } from 'react'
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

  useEffect(() => {
    let pose: Pose | null = null
    let isProcessing = false

    const initializePose = async () => {
      try {
        pose = new Pose({
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

        pose.onResults(onPoseResults)

        if (videoRef.current) {
          videoRef.current.src = videoUrl
          await videoRef.current.load()
          processVideo()
        }
      } catch (err) {
        onError(`姿勢推定の初期化に失敗しました: ${err}`)
      }
    }

    const onPoseResults = (results: PoseResults) => {
      if (!canvasRef.current || !videoRef.current) return

      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // Set canvas size to match video
      canvas.width = videoRef.current.videoWidth
      canvas.height = videoRef.current.videoHeight

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height)

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

        // Store pose data with timestamp
        poseFramesRef.current.push({
          timestamp: videoRef.current.currentTime,
          landmarks: results.poseLandmarks
        })
      }
    }

    const processVideo = async () => {
      if (!pose || !videoRef.current || isProcessing) return

      isProcessing = true
      const video = videoRef.current
      poseFramesRef.current = []

      try {
        // Process video frame by frame
        const fps = 30 // Process at 30 fps
        const interval = 1 / fps

        for (let time = 0; time < video.duration; time += interval) {
          video.currentTime = time
          await new Promise(resolve => {
            video.onseeked = resolve
          })
          await pose.send({ image: video })
        }

        // Analyze collected pose data
        const evaluator = new SnowboardEvaluator()
        const result = evaluator.evaluate(poseFramesRef.current)
        onAnalysisComplete(result)
      } catch (err) {
        onError(`動画の分析中にエラーが発生しました: ${err}`)
      } finally {
        isProcessing = false
      }
    }

    initializePose()

    return () => {
      if (pose) {
        pose.close()
      }
    }
  }, [videoUrl, onAnalysisComplete, onError])

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <video
        ref={videoRef}
        style={{ display: 'none' }}
      />
      <canvas
        ref={canvasRef}
        style={{ maxWidth: '100%', border: '2px solid #646cff', borderRadius: '8px' }}
      />
    </div>
  )
}
