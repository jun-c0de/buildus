import { useState, useRef, useEffect } from 'react';
import { generateResponse } from '../utils/aiEngine';

const QUICK_QUESTIONS = [
  '25평 전체 인테리어 비용이 얼마에요?',
  '인테리어 공정 순서 알려줘',
  '욕실 방수 꼭 해야 하나요?',
  '실크벽지랑 합지벽지 차이가 뭔가요?',
  '혼자 할 수 있는 공정이 뭐가 있어요?',
];

const WELCOME = {
  id: 0,
  role: 'assistant',
  text: '안녕하세요! 빌드어스 AI 상담사입니다 👋\n\n인테리어 견적, 공정 순서, 자재 추천, 셀프 시공 난이도 등을 물어보세요.\n자재 DB 1,304개 + 공정 13개 데이터 기반으로 답변해드립니다.',
  time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
};

export default function AIChat() {
  const [messages, setMessages] = useState([WELCOME]);
  const [input,    setInput]    = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  function send(text) {
    const msg = (text ?? input).trim();
    if (!msg || isTyping) return;
    setInput('');

    const time = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    setMessages(prev => [...prev, { id: Date.now(), role: 'user', text: msg, time }]);
    setIsTyping(true);

    // 로컬 엔진 응답 (약간의 딜레이로 자연스럽게)
    setTimeout(() => {
      const response = generateResponse(msg);
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'assistant',
        text: response,
        time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      }]);
      setIsTyping(false);
    }, 600);
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', height: 'calc(100vh - 60px)', display: 'flex', flexDirection: 'column', padding: '0 16px' }}>

      {/* 헤더 */}
      <div style={{ padding: '20px 0 12px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: '#1A1A1A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🤖</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: '#1A1A1A' }}>빌드어스 AI 상담</div>
            <div style={{ fontSize: 12, color: '#10B981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
              자재 DB · 공정 데이터 기반 응답
            </div>
          </div>
        </div>
      </div>

      {/* 메시지 영역 */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, padding: '12px 0' }}>
        {messages.map(msg => (
          <div key={msg.id} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: 8, alignItems: 'flex-end' }}>
            {msg.role === 'assistant' && (
              <div style={{ width: 32, height: 32, borderRadius: 10, background: '#1A1A1A', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🤖</div>
            )}
            <div style={{ maxWidth: '78%', display: 'flex', flexDirection: 'column', gap: 4, alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                padding: '12px 16px',
                borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                background: msg.role === 'user' ? '#1A1A1A' : 'white',
                color: msg.role === 'user' ? 'white' : '#1A1A1A',
                fontSize: 14, lineHeight: 1.75, whiteSpace: 'pre-line',
                border: msg.role === 'assistant' ? '1px solid #E2E8F0' : 'none',
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              }}>{msg.text}</div>
              <span style={{ fontSize: 11, color: '#94A3B8' }}>{msg.time}</span>
            </div>
            {msg.role === 'user' && (
              <div style={{ width: 32, height: 32, borderRadius: 10, background: '#E8540A', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: 'white', fontWeight: 700 }}>나</div>
            )}
          </div>
        ))}

        {isTyping && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: '#1A1A1A', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🤖</div>
            <div style={{ padding: '14px 18px', borderRadius: '18px 18px 18px 4px', background: 'white', border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', gap: 4, alignItems: 'center' }}>
              {[0,1,2].map(i => (
                <span key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: '#94A3B8', animation: 'bounce 1.2s infinite', animationDelay: `${i*0.2}s`, display: 'inline-block' }} />
              ))}
              <style>{`@keyframes bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-6px)}}`}</style>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* 빠른 질문 */}
      {messages.length <= 1 && (
        <div style={{ flexShrink: 0, paddingBottom: 12 }}>
          <div style={{ fontSize: 12, color: '#94A3B8', fontWeight: 600, marginBottom: 8 }}>빠른 질문</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {QUICK_QUESTIONS.map((q, i) => (
              <button key={i} onClick={() => send(q)} style={{
                padding: '7px 12px', borderRadius: 20, border: '1px solid #E2E8F0',
                background: 'white', color: '#475569', fontSize: 12, cursor: 'pointer', fontWeight: 500,
              }}
                onMouseEnter={e => { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.borderColor = '#CBD5E1'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = '#E2E8F0'; }}
              >{q}</button>
            ))}
          </div>
        </div>
      )}

      {/* 입력창 */}
      <div style={{ flexShrink: 0, paddingBottom: 20, display: 'flex', gap: 10, alignItems: 'flex-end' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: 'white', border: '1.5px solid #E2E8F0', borderRadius: 14, padding: '10px 16px', gap: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="예: 25평 도배 비용이 얼마에요? / 타일 공정 순서 알려줘"
            rows={1}
            style={{ flex: 1, border: 'none', outline: 'none', resize: 'none', fontSize: 14, lineHeight: 1.5, color: '#1A1A1A', background: 'transparent', fontFamily: 'inherit', maxHeight: 120, overflowY: 'auto' }}
          />
        </div>
        <button onClick={() => send()} disabled={!input.trim() || isTyping} style={{
          width: 44, height: 44, borderRadius: 12, border: 'none',
          background: input.trim() && !isTyping ? '#1A1A1A' : '#E2E8F0',
          color: input.trim() && !isTyping ? 'white' : '#94A3B8',
          cursor: input.trim() && !isTyping ? 'pointer' : 'default',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0,
        }}>↑</button>
      </div>
    </div>
  );
}
