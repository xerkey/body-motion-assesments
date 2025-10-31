import { NormalizedLandmark } from '@mediapipe/pose'

export interface PoseFrame {
  timestamp: number
  landmarks: NormalizedLandmark[]
}

export interface EvaluationResult {
  overallScore: number
  balanceScore: number
  postureScore: number
  smoothnessScore: number
  edgeControlScore: number
  feedback: string[]
  details: {
    avgCenterOfMass: { x: number; y: number }
    posturalStability: number
    movementVariation: number
    kneeFlexion: number
  }
}

export class SnowboardEvaluator {
  // MediaPipe pose landmark indices
  private readonly NOSE = 0
  private readonly LEFT_SHOULDER = 11
  private readonly RIGHT_SHOULDER = 12
  private readonly LEFT_HIP = 23
  private readonly RIGHT_HIP = 24
  private readonly LEFT_KNEE = 25
  private readonly RIGHT_KNEE = 26
  private readonly LEFT_ANKLE = 27
  private readonly RIGHT_ANKLE = 28

  evaluate(frames: PoseFrame[]): EvaluationResult {
    if (frames.length === 0) {
      return this.getDefaultResult()
    }

    const balanceScore = this.evaluateBalance(frames)
    const postureScore = this.evaluatePosture(frames)
    const smoothnessScore = this.evaluateSmoothness(frames)
    const edgeControlScore = this.evaluateEdgeControl(frames)

    const overallScore = (
      balanceScore * 0.3 +
      postureScore * 0.25 +
      smoothnessScore * 0.25 +
      edgeControlScore * 0.2
    )

    const feedback = this.generateFeedback({
      balanceScore,
      postureScore,
      smoothnessScore,
      edgeControlScore
    })

    const details = this.calculateDetails(frames)

    return {
      overallScore: Math.round(overallScore),
      balanceScore: Math.round(balanceScore),
      postureScore: Math.round(postureScore),
      smoothnessScore: Math.round(smoothnessScore),
      edgeControlScore: Math.round(edgeControlScore),
      feedback,
      details
    }
  }

  private evaluateBalance(frames: PoseFrame[]): number {
    let totalBalance = 0

    for (const frame of frames) {
      const landmarks = frame.landmarks

      // Calculate center of mass (average of shoulders and hips)
      const leftShoulder = landmarks[this.LEFT_SHOULDER]
      const rightShoulder = landmarks[this.RIGHT_SHOULDER]
      const leftHip = landmarks[this.LEFT_HIP]
      const rightHip = landmarks[this.RIGHT_HIP]
      const leftAnkle = landmarks[this.LEFT_ANKLE]
      const rightAnkle = landmarks[this.RIGHT_ANKLE]

      const centerX = (leftShoulder.x + rightShoulder.x + leftHip.x + rightHip.x) / 4
      const baseX = (leftAnkle.x + rightAnkle.x) / 2

      // Balance score based on how centered the body is over the feet
      const horizontalOffset = Math.abs(centerX - baseX)
      const frameBalance = Math.max(0, 100 - (horizontalOffset * 500))

      totalBalance += frameBalance
    }

    return totalBalance / frames.length
  }

  private evaluatePosture(frames: PoseFrame[]): number {
    let totalPosture = 0

    for (const frame of frames) {
      const landmarks = frame.landmarks

      // Check knee flexion
      const leftKnee = landmarks[this.LEFT_KNEE]
      const rightKnee = landmarks[this.RIGHT_KNEE]
      const leftHip = landmarks[this.LEFT_HIP]
      const rightHip = landmarks[this.RIGHT_HIP]
      const leftAnkle = landmarks[this.LEFT_ANKLE]
      const rightAnkle = landmarks[this.RIGHT_ANKLE]

      // Calculate knee angle
      const leftKneeAngle = this.calculateAngle(leftHip, leftKnee, leftAnkle)
      const rightKneeAngle = this.calculateAngle(rightHip, rightKnee, rightAnkle)
      const avgKneeAngle = (leftKneeAngle + rightKneeAngle) / 2

      // Ideal knee flexion for snowboarding is between 120-150 degrees
      let kneeScore = 100
      if (avgKneeAngle < 120 || avgKneeAngle > 150) {
        const deviation = Math.min(Math.abs(avgKneeAngle - 135), 45)
        kneeScore = Math.max(0, 100 - (deviation * 2))
      }

      // Check upper body alignment
      const leftShoulder = landmarks[this.LEFT_SHOULDER]
      const rightShoulder = landmarks[this.RIGHT_SHOULDER]
      const shoulderMidpoint = {
        x: (leftShoulder.x + rightShoulder.x) / 2,
        y: (leftShoulder.y + rightShoulder.y) / 2
      }
      const hipMidpoint = {
        x: (leftHip.x + rightHip.x) / 2,
        y: (leftHip.y + rightHip.y) / 2
      }

      // Upper body should be relatively aligned over hips
      const alignmentOffset = Math.abs(shoulderMidpoint.x - hipMidpoint.x)
      const alignmentScore = Math.max(0, 100 - (alignmentOffset * 300))

      const framePosture = (kneeScore * 0.6 + alignmentScore * 0.4)
      totalPosture += framePosture
    }

    return totalPosture / frames.length
  }

  private evaluateSmoothness(frames: PoseFrame[]): number {
    if (frames.length < 2) return 100

    let totalVariation = 0
    const positions: { x: number; y: number }[] = []

    // Track center of mass movement
    for (const frame of frames) {
      const landmarks = frame.landmarks
      const centerX = (landmarks[this.LEFT_HIP].x + landmarks[this.RIGHT_HIP].x) / 2
      const centerY = (landmarks[this.LEFT_HIP].y + landmarks[this.RIGHT_HIP].y) / 2
      positions.push({ x: centerX, y: centerY })
    }

    // Calculate movement variation (jerkiness)
    for (let i = 1; i < positions.length; i++) {
      const dx = positions[i].x - positions[i - 1].x
      const dy = positions[i].y - positions[i - 1].y
      const distance = Math.sqrt(dx * dx + dy * dy)
      totalVariation += distance
    }

    const avgVariation = totalVariation / (positions.length - 1)

    // Lower variation = smoother movement
    // Normalize variation to a score (assuming typical variation is around 0.01-0.05)
    const smoothnessScore = Math.max(0, Math.min(100, 100 - (avgVariation * 1000)))

    return smoothnessScore
  }

  private evaluateEdgeControl(frames: PoseFrame[]): number {
    let totalEdgeControl = 0

    for (const frame of frames) {
      const landmarks = frame.landmarks

      // Edge control is indicated by:
      // 1. Ankle angle relative to knee
      // 2. Weight distribution

      const leftKnee = landmarks[this.LEFT_KNEE]
      const rightKnee = landmarks[this.RIGHT_KNEE]
      const leftAnkle = landmarks[this.LEFT_ANKLE]
      const rightAnkle = landmarks[this.RIGHT_ANKLE]

      // Check if ankles are relatively level (good edge engagement)
      const ankleLevelDiff = Math.abs(leftAnkle.y - rightAnkle.y)
      const levelScore = Math.max(0, 100 - (ankleLevelDiff * 500))

      // Check ankle-knee alignment
      const leftAlignment = Math.abs(leftAnkle.x - leftKnee.x)
      const rightAlignment = Math.abs(rightAnkle.x - rightKnee.x)
      const avgAlignment = (leftAlignment + rightAlignment) / 2
      const alignmentScore = Math.max(0, 100 - (avgAlignment * 500))

      const frameEdgeControl = (levelScore * 0.5 + alignmentScore * 0.5)
      totalEdgeControl += frameEdgeControl
    }

    return totalEdgeControl / frames.length
  }

  private calculateAngle(
    point1: NormalizedLandmark,
    point2: NormalizedLandmark,
    point3: NormalizedLandmark
  ): number {
    const vector1 = {
      x: point1.x - point2.x,
      y: point1.y - point2.y
    }
    const vector2 = {
      x: point3.x - point2.x,
      y: point3.y - point2.y
    }

    const dotProduct = vector1.x * vector2.x + vector1.y * vector2.y
    const magnitude1 = Math.sqrt(vector1.x ** 2 + vector1.y ** 2)
    const magnitude2 = Math.sqrt(vector2.x ** 2 + vector2.y ** 2)

    const cosAngle = dotProduct / (magnitude1 * magnitude2)
    const angleRad = Math.acos(Math.max(-1, Math.min(1, cosAngle)))
    const angleDeg = (angleRad * 180) / Math.PI

    return angleDeg
  }

  private calculateDetails(frames: PoseFrame[]) {
    let totalCenterX = 0
    let totalCenterY = 0
    let totalKneeFlexion = 0

    for (const frame of frames) {
      const landmarks = frame.landmarks
      const centerX = (landmarks[this.LEFT_HIP].x + landmarks[this.RIGHT_HIP].x) / 2
      const centerY = (landmarks[this.LEFT_HIP].y + landmarks[this.RIGHT_HIP].y) / 2
      totalCenterX += centerX
      totalCenterY += centerY

      const leftKneeAngle = this.calculateAngle(
        landmarks[this.LEFT_HIP],
        landmarks[this.LEFT_KNEE],
        landmarks[this.LEFT_ANKLE]
      )
      const rightKneeAngle = this.calculateAngle(
        landmarks[this.RIGHT_HIP],
        landmarks[this.RIGHT_KNEE],
        landmarks[this.RIGHT_ANKLE]
      )
      totalKneeFlexion += (leftKneeAngle + rightKneeAngle) / 2
    }

    return {
      avgCenterOfMass: {
        x: totalCenterX / frames.length,
        y: totalCenterY / frames.length
      },
      posturalStability: this.evaluateBalance(frames),
      movementVariation: 100 - this.evaluateSmoothness(frames),
      kneeFlexion: totalKneeFlexion / frames.length
    }
  }

  private generateFeedback(scores: {
    balanceScore: number
    postureScore: number
    smoothnessScore: number
    edgeControlScore: number
  }): string[] {
    const feedback: string[] = []

    // Balance feedback
    if (scores.balanceScore >= 80) {
      feedback.push('✓ 優れたバランス感覚です！体重が適切に配分されています。')
    } else if (scores.balanceScore >= 60) {
      feedback.push('△ バランスは良好ですが、さらに重心を意識してみましょう。')
    } else {
      feedback.push('✗ バランスの改善が必要です。重心を足の真上に保つよう意識しましょう。')
    }

    // Posture feedback
    if (scores.postureScore >= 80) {
      feedback.push('✓ 理想的な姿勢を保っています！膝の曲げ具合が適切です。')
    } else if (scores.postureScore >= 60) {
      feedback.push('△ 姿勢は悪くありませんが、膝をもう少し曲げるとより安定します。')
    } else {
      feedback.push('✗ 姿勢を改善しましょう。膝を適度に曲げ、上体をリラックスさせてください。')
    }

    // Smoothness feedback
    if (scores.smoothnessScore >= 80) {
      feedback.push('✓ とても滑らかな動きです！リズムが一定で安定しています。')
    } else if (scores.smoothnessScore >= 60) {
      feedback.push('△ 動きはそこそこ滑らかですが、より流れるような動きを目指しましょう。')
    } else {
      feedback.push('✗ 動きがぎこちないです。リラックスして滑らかなターンを心がけましょう。')
    }

    // Edge control feedback
    if (scores.edgeControlScore >= 80) {
      feedback.push('✓ エッジコントロールが素晴らしいです！')
    } else if (scores.edgeControlScore >= 60) {
      feedback.push('△ エッジコントロールは良好です。さらに精度を高めましょう。')
    } else {
      feedback.push('✗ エッジコントロールの改善が必要です。足首と膝の連動を意識しましょう。')
    }

    return feedback
  }

  private getDefaultResult(): EvaluationResult {
    return {
      overallScore: 0,
      balanceScore: 0,
      postureScore: 0,
      smoothnessScore: 0,
      edgeControlScore: 0,
      feedback: ['動画の分析に失敗しました。別の動画でお試しください。'],
      details: {
        avgCenterOfMass: { x: 0, y: 0 },
        posturalStability: 0,
        movementVariation: 0,
        kneeFlexion: 0
      }
    }
  }
}
