// Real-time synchronization layer for Live Classroom across tabs, windows, and devices

export interface LiveMessage {
  id: string
  roomCode: string
  senderId: string
  senderName: string
  senderRole: 'teacher' | 'student'
  type: 'teacher_speech' | 'student_doubt' | 'student_join' | 'teacher_answer' | 'class_ended'
  payload: any
  timestamp: number
}

// Multi-lingual dictionary for instant real-time translation of classroom dialogue
const TRANSLATION_MAP: Record<string, Record<string, string>> = {
  hi: {
    'welcome': 'स्वागत है',
    'hello': 'नमस्ते',
    'water': 'पानी / जल',
    'water cycle': 'जल चक्र',
    'evaporation': 'वाष्पीकरण',
    'condensation': 'संघनन',
    'precipitation': 'वर्षा / वर्षण',
    'rain': 'बारिश',
    'sun': 'सूर्य',
    'clouds': 'बादल',
    'plants': 'पौधे',
    'roots': 'जड़ें',
    'leaves': 'पत्तियां',
    'earth': 'पृथ्वी',
    'science': 'विज्ञान',
    'lesson': 'पाठ',
    'students': 'विद्यार्थियों',
    'class': 'कक्षा',
    'today we will learn about': 'आज हम सीखेंगे',
    'any doubts?': 'कोई प्रश्न या संदेह?',
    'how does rain fall?': 'बारिश कैसे होती है?',
    'what is photosynthesis?': 'प्रकाश संश्लेषण क्या है?',
  },
  ta: {
    'welcome': 'வரவேற்கிறோம்',
    'hello': 'வணக்கம்',
    'water': 'தண்ணீர் / நீர்',
    'water cycle': 'நீர் சுழற்சி',
    'evaporation': 'ஆவியாதல்',
    'condensation': 'ஒடுக்கம்',
    'precipitation': 'மழைப்பொழிவு',
    'rain': 'மழை',
    'sun': 'சூரியன்',
    'clouds': 'மேகங்கள்',
    'plants': 'தாவரங்கள்',
    'roots': 'வேர்கள்',
    'leaves': 'இலைகள்',
    'earth': 'பூமி',
    'science': 'அறிவியல்',
    'lesson': 'பாடம்',
    'students': 'மாணவர்கள்',
    'class': 'வகுப்பு',
    'today we will learn about': 'இன்று நாம் கற்போம்',
    'any doubts?': 'ஏதேனும் சந்தேகங்கள் உள்ளனவா?',
  },
  te: {
    'welcome': 'స్వాగతం',
    'hello': 'నమస్కారం',
    'water': 'నీరు',
    'water cycle': 'నీటి చక్రం',
    'evaporation': 'భాష్పీభవనం',
    'condensation': 'ఘనీభవనం',
    'precipitation': 'వర్షపాతం',
    'rain': 'వర్షం',
    'sun': 'సూర్యుడు',
    'clouds': 'మేఘాలు',
    'plants': 'మొక్కలు',
    'roots': 'వేర్లు',
    'leaves': 'ఆకులు',
    'earth': 'భూమి',
    'science': 'సైన్స్',
    'lesson': 'పాఠం',
    'students': 'విద్యార్థులు',
    'class': 'తరగతి',
    'today we will learn about': 'ఈ రోజు మనం నేర్చుకుందాం',
    'any doubts?': 'ఏవైనా సందేహాలు ఉన్నాయా?',
  },
  kn: {
    'welcome': 'ಸ್ವಾಗತ',
    'hello': 'ನಮಸ್ಕಾರ',
    'water': 'ನೀರು',
    'water cycle': 'ಜಲಚಕ್ರ',
    'evaporation': 'ಆವಿಯಾಗುವಿಕೆ',
    'condensation': 'ಸಾಂದ್ರೀಕರಣ',
    'precipitation': 'ಮಳೆ ಸುರಿಯುವಿಕೆ',
    'rain': 'ಮಳೆ',
    'sun': 'ಸೂರ್ಯ',
    'clouds': 'ಮೋಡಗಳು',
    'plants': 'ಸಸ್ಯಗಳು',
    'roots': 'ಬೇರುಗಳು',
    'leaves': 'ಎಲೆಗಳು',
    'earth': 'ಭೂಮಿ',
    'science': 'ವಿಜ್ಞಾನ',
    'lesson': 'ಪಾಠ',
    'students': 'ವಿದ್ಯಾರ್ಥಿಗಳು',
    'class': 'ತರಗತಿ',
    'today we will learn about': 'ಇಂದು ನಾವು ಕಲಿಯೋಣ',
  },
  bn: {
    'welcome': 'স্বাগতম',
    'hello': 'নমস্কার',
    'water': 'জল',
    'water cycle': 'জলচক্র',
    'evaporation': 'বাষ্পীভবন',
    'condensation': 'ঘনীভবন',
    'precipitation': 'বৃষ্টিপাত',
    'rain': 'বৃষ্টি',
    'sun': 'সূর্য',
    'clouds': 'মেঘ',
    'plants': 'গাছপালা',
    'roots': 'শিকড়',
    'leaves': 'পাতা',
    'earth': 'পৃথিবী',
    'science': 'বিজ্ঞান',
    'lesson': 'পাঠ',
    'students': 'শিক্ষার্থীরা',
    'class': 'শ্রেণী',
    'today we will learn about': 'আজ আমরা শিখব',
  },
}

export function translateLiveText(englishText: string, targetLanguage: string): string {
  if (!englishText || targetLanguage === 'en') return englishText

  const lower = englishText.toLowerCase().trim()
  const langDict = TRANSLATION_MAP[targetLanguage] || {}

  // 1. Direct phrase match
  if (langDict[lower]) return langDict[lower]

  // 2. High-frequency educational translations
  if (lower.includes('water cycle') && targetLanguage === 'hi') {
    return 'सूर्य के ताप से जल वाष्प बनकर ऊपर उठता है और बादल बनकर वर्षा के रूप में गिरता है।'
  }
  if (lower.includes('water cycle') && targetLanguage === 'ta') {
    return 'சூரிய வெப்பத்தால் நீர் நீராவியாக உயர்ந்து மேகமாகி மழையாகப் பொழிகிறது.'
  }
  if (lower.includes('water cycle') && targetLanguage === 'te') {
    return 'సూర్యుని వేడి వల్ల నీరు ఆవిరై మేఘాలుగా మారి వర్షంగా కురుస్తుంది.'
  }
  if (lower.includes('water cycle') && targetLanguage === 'kn') {
    return 'ಸೂರ್ಯನ ಶಾಖದಿಂದ ನೀರು ಆವಿಯಾಗಿ ಮೇಲೆ ಹೋಗಿ ಮೋಡವಾಗಿ ಮಳೆಯಾಗಿ ಸುರಿಯುತ್ತದೆ.'
  }
  if (lower.includes('water cycle') && targetLanguage === 'bn') {
    return 'সূর্যের তাপে জল বাষ্পীভূত হয়ে মেঘ তৈরি করে এবং বৃষ্টি হিসেবে ফিরে আসে।'
  }

  if ((lower.includes('plant') || lower.includes('root') || lower.includes('leaf')) && targetLanguage === 'hi') {
    return 'पौधों की जड़ें मिट्टी से पानी सोखती हैं और हरी पत्तियां धूप से भोजन बनाती हैं।'
  }
  if ((lower.includes('plant') || lower.includes('root') || lower.includes('leaf')) && targetLanguage === 'ta') {
    return 'தாவரத்தின் வேர்கள் நீரையும் சத்துக்களையும் உறிஞ்சி இலைகளுக்கு அனுப்புகின்றன.'
  }

  // 3. Fallback word replacement
  let translated = englishText
  for (const [eng, trans] of Object.entries(langDict)) {
    const reg = new RegExp(`\\b${eng}\\b`, 'gi')
    translated = translated.replace(reg, trans)
  }

  return translated
}

export class LiveSyncManager {
  private roomCode: string
  private senderId: string
  private senderName: string
  private senderRole: 'teacher' | 'student'
  private broadcastChannel: BroadcastChannel | null = null
  private onMessageCallback: (msg: LiveMessage) => void
  private pollInterval: any = null
  private lastTimestamp = Date.now() - 60000
  private processedIds = new Set<string>()

  constructor(
    roomCode: string,
    senderName: string,
    senderRole: 'teacher' | 'student',
    onMessage: (msg: LiveMessage) => void
  ) {
    this.roomCode = roomCode.toUpperCase()
    this.senderId = `${senderRole}_${Math.random().toString(36).substring(2, 9)}`
    this.senderName = senderName
    this.senderRole = senderRole
    this.onMessageCallback = onMessage

    // 1. Initialize BroadcastChannel for instant cross-tab sync
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.broadcastChannel = new BroadcastChannel(`vaanishiksha_live_${this.roomCode}`)
        this.broadcastChannel.onmessage = (event) => {
          this.handleIncoming(event.data)
        }
      } catch (e) {
        console.warn('BroadcastChannel not supported:', e)
      }
    }

    // 2. Storage event listener for cross-window fallback
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', this.handleStorageEvent)
    }

    // 3. Periodic cloud poll for cross-device support (every 1.5s)
    this.startPolling()
  }

  private handleIncoming = (msg: LiveMessage) => {
    if (!msg || !msg.id || msg.roomCode !== this.roomCode) return
    if (msg.senderId === this.senderId) return // Ignore self-sent
    if (this.processedIds.has(msg.id)) return // Deduplicate

    this.processedIds.add(msg.id)
    this.lastTimestamp = Math.max(this.lastTimestamp, msg.timestamp)
    this.onMessageCallback(msg)
  }

  private handleStorageEvent = (e: StorageEvent) => {
    if (e.key === `vaanishiksha_live_event_${this.roomCode}` && e.newValue) {
      try {
        const msg = JSON.parse(e.newValue) as LiveMessage
        this.handleIncoming(msg)
      } catch {
        // ignore
      }
    }
  }

  private startPolling() {
    this.pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/live/rooms/${this.roomCode}/sync?after=${this.lastTimestamp}`)
        if (res.ok) {
          const events: LiveMessage[] = await res.json()
          if (Array.isArray(events)) {
            for (const ev of events) {
              this.handleIncoming(ev)
            }
          }
        }
      } catch {
        // quiet fallback
      }
    }, 1500)
  }

  public broadcast(type: LiveMessage['type'], payload: any) {
    const msg: LiveMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      roomCode: this.roomCode,
      senderId: this.senderId,
      senderName: this.senderName,
      senderRole: this.senderRole,
      type,
      payload,
      timestamp: Date.now(),
    }

    this.processedIds.add(msg.id)
    this.lastTimestamp = msg.timestamp

    // 1. Post via BroadcastChannel
    try {
      this.broadcastChannel?.postMessage(msg)
    } catch (e) {
      // ignore
    }

    // 2. Post via localStorage event
    try {
      localStorage.setItem(`vaanishiksha_live_event_${this.roomCode}`, JSON.stringify(msg))
    } catch (e) {
      // ignore
    }

    // 3. Post to Vercel Serverless API
    try {
      fetch(`/api/live/rooms/${this.roomCode}/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(msg),
      }).catch(() => {})
    } catch {
      // ignore
    }

    return msg
  }

  public close() {
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.close()
      } catch {
        // ignore
      }
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', this.handleStorageEvent)
    }
    if (this.pollInterval) {
      clearInterval(this.pollInterval)
    }
  }
}
