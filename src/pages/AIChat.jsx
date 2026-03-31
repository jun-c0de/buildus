import { useState, useRef, useEffect } from 'react';

const QUICK_QUESTIONS = [
  '25평 전체 인테리어 비용이 얼마나 될까요?',
  '욕실 타일 교체만 하면 얼마나 걸리나요?',
  '강화마루와 LVT 중 어떤 게 나을까요?',
  '발코니 확장 시 주의사항이 있나요?',
];

const WELCOME = {
  id: 0,
  role: 'assistant',
  text: '안녕하세요! 빌드어스 AI 상담사입니다 👋\n인테리어 견적, 자재 선택, 시공 방법 등 무엇이든 물어보세요.',
  time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
};

export default function AIChat() {
  const [messages, setMessages] = useState([WELCOME]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  function send(text) {
    const msg = text || input.trim();
    if (!msg) return;
    setInput('');

    const time = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    setMessages(prev => [...prev, { id: Date.now(), role: 'user', text: msg, time }]);
    setIsTyping(true);

    // Placeholder response after short delay
    setTimeout(() => {
      setIsTyping(false);
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'assistant',
        text: '현재 AI 상담 기능을 준비 중입니다. 빠른 시일 내에 정식 서비스를 제공할 예정입니다.\n\n궁금한 사항은 커뮤니티 게시판을 이용해 주세요! 😊',
        time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      }]);
    }, 1200);
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', height: 'calc(100vh - 60px)', display: 'flex', flexDirection: 'column', padding: '0 16px' }}>

      {/* 채팅 헤더 */}
      <div style={{ padding: '20px 0 12px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 14, background: '#1A1A1A',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
          }}>🤖</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: '#1A1A1A' }}>빌드어스 AI 상담</div>
            <div style={{ fontSize: 12, color: '#10B981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
              서비스 준비 중
            </div>
          </div>
        </div>
      </div>

      {/* 메시지 영역 */}
      <div style={{
        flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16,
        padding: '12px 0',
      }}>
        {messages.map(msg => (
          <div key={msg.id} style={{
            display: 'flex',
            justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            gap: 8, alignItems: 'flex-end',
          }}>
            {msg.role === 'assistant' && (
              <div style={{
                width: 32, height: 32, borderRadius: 10, background: '#1A1A1A', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
              }}>🤖</div>
            )}
            <div style={{ maxWidth: '75%', display: 'flex', flexDirection: 'column', gap: 4, alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                padding: '12px 16px', borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                background: msg.role === 'user' ? '#1A1A1A' : 'white',
                color: msg.role === 'user' ? 'white' : '#1A1A1A',
                fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-line',
                border: msg.role === 'assistant' ? '1px solid #E2E8F0' : 'none',
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              }}>{msg.text}</div>
              <span style={{ fontSize: 11, color: '#94A3B8' }}>{msg.time}</span>
            </div>
            {msg.role === 'user' && (
              <div style={{
                width: 32, height: 32, borderRadius: 10, background: '#E8540A', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: 'white', fontWeight: 700,
              }}>나</div>
            )}
          </div>
        ))}

        {isTyping && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10, background: '#1A1A1A', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
            }}>🤖</div>
            <div style={{
              padding: '14px 18px', borderRadius: '18px 18px 18px 4px',
              background: 'white', border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              display: 'flex', gap: 4, alignItems: 'center',
            }}>
              {[0, 1, 2].map(i => (
                <span key={i} style={{
                  width: 7, height: 7, borderRadius: '50%', background: '#94A3B8',
                  animation: 'bounce 1.2s infinite', animationDelay: `${i * 0.2}s`,
                  display: 'inline-block',
                }} />
              ))}
              <style>{`@keyframes bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-6px)} }`}</style>
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
                background: 'white', color: '#475569', fontSize: 12, cursor: 'pointer',
                fontWeight: 500, transition: 'all 0.1s',
              }}
                onMouseEnter={e => { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.borderColor = '#CBD5E1'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = '#E2E8F0'; }}
              >{q}</button>
            ))}
          </div>
        </div>
      )}

      {/* 입력창 */}
      <div style={{
        flexShrink: 0, paddingBottom: 20,
        display: 'flex', gap: 10, alignItems: 'flex-end',
      }}>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center',
          background: 'white', border: '1.5px solid #E2E8F0', borderRadius: 14,
          padding: '10px 16px', gap: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
          transition: 'border-color 0.15s',
        }}
          onFocus={() => {}}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="인테리어에 대해 무엇이든 물어보세요..."
            rows={1}
            style={{
              flex: 1, border: 'none', outline: 'none', resize: 'none',
              fontSize: 14, lineHeight: 1.5, color: '#1A1A1A',
              background: 'transparent', fontFamily: 'inherit',
              maxHeight: 120, overflowY: 'auto',
            }}
          />
        </div>
        <button
          onClick={() => send()}
          disabled={!input.trim()}
          style={{
            width: 44, height: 44, borderRadius: 12, border: 'none',
            background: input.trim() ? '#1A1A1A' : '#E2E8F0',
            color: input.trim() ? 'white' : '#94A3B8',
            cursor: input.trim() ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, transition: 'all 0.15s', flexShrink: 0,
          }}
        >↑</button>
      </div>
    </div>
  );
}
