"use client";
import { useState, useEffect, useRef } from "react";
import SidebarLayout from "../components/SidebarLayout";

interface Message {
  message: string;
  username: string;
  time_ago: string;
  encoded_url: string;
  username_text_color: string;
}

interface ShoutsResponse {
  count: number;
  last_fetch: string;
  messages: Message[];
}

const Shoutbox = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const hasScrolledInitially = useRef(false);

  const fetchMessages = async () => {
    try {
      const response = await fetch('https://server-details.ej.workers.dev/shouts');
      const data: ShoutsResponse = await response.json();
      
      if (data.messages && Array.isArray(data.messages)) {
        // Reverse the array so first message appears at bottom
        setMessages([...data.messages].reverse());
        setError(null);
      }
    } catch (err) {
      console.error('Failed to fetch shouts:', err);
      setError('Failed to fetch messages');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Fetch immediately on mount
    fetchMessages();

    // Then fetch every 5 seconds
    const interval = setInterval(() => {
      fetchMessages();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Scroll to bottom only on initial load
  useEffect(() => {
    if (!loading && messages.length > 0 && !hasScrolledInitially.current && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
      hasScrolledInitially.current = true;
    }
  }, [loading, messages]);

  return (
    <SidebarLayout>
        <div className="flex flex-col h-screen">
          <div className="bg-gray-900 border-b border-gray-700 px-4 sm:px-6 py-2 sm:py-3">
            <h1 className="text-white text-lg sm:text-xl font-mono">#shoutbox</h1>
          </div>

          <div className="flex-1 overflow-y-auto bg-black p-3 sm:p-4 font-mono text-xs sm:text-sm" ref={scrollContainerRef}>
            {loading && messages.length === 0 ? (
              <div className="text-gray-500 text-center py-12">
                Loading messages...
              </div>
            ) : error ? (
              <div className="text-red-500 text-center py-12">
                {error}
              </div>
            ) : messages.length === 0 ? (
              <div className="text-gray-500 text-center py-12">
                No messages available
              </div>
            ) : (
              <div className="w-full space-y-1">
                {messages.map((msg, index) => (
                  <div key={index} className="py-1 break-words">
                    <span className="text-gray-600">[{msg.time_ago}]</span>{' '}
                    <a
                      href={msg.encoded_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`hover:underline ${
                        msg.username_text_color === 'red' ? 'text-red-400' : 'text-blue-400'
                      }`}
                    >
                      &lt;{msg.username}&gt;
                    </a>{' '}
                    <span className="text-gray-300">{msg.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
    </SidebarLayout>
  );
};

export default Shoutbox;

