"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Bot,
  Send,
  Plus,
  Trash2,
  X,
  Settings,
  Paperclip,
  FileText,
} from "lucide-react";
import ChartJSFromRange from "./ChartJSFromRange";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

interface ResizableAISidebarProps {
  spreadsheetId: Id<"spreadsheets">;
  sheetData: any[];
  selectedRange?: string;
  activeSheetName?: string;
  isOpen: boolean;
  onToggle: () => void;
}

export default function ResizableAISidebar({
  spreadsheetId,
  sheetData,
  selectedRange,
  activeSheetName,
  isOpen,
  onToggle,
}: ResizableAISidebarProps) {
  const [currentConversationId, setCurrentConversationId] = useState<Id<"aiConversations"> | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(400);
  const [isResizing, setIsResizing] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<Id<"aiAgents"> | null>(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Convex queries and mutations
  const conversations = useQuery(api.ai.getConversations, { spreadsheetId });
  const messages = useQuery(
    api.ai.getMessages,
    currentConversationId ? { conversationId: currentConversationId } : "skip"
  );
  const agents = useQuery(api.aiAgents.getAgents, {});
  const documents = useQuery(api.documents.listDocuments, { spreadsheetId });
  
  const createConversation = useMutation(api.ai.createConversation);
  const sendMessage = useMutation(api.ai.sendMessage);
  const deleteConversation = useMutation(api.ai.deleteConversation);
  const getSheetData = useQuery(api.ai.getSheetData, { spreadsheetId });
  const getDefaultAgents = useMutation(api.aiAgents.getDefaultAgents);
  const generateUploadUrl = useMutation(api.documents.generateUploadUrl);
  const createDocument = useMutation(api.documents.createDocument);
  const deleteDocument = useMutation(api.documents.deleteDocument);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleCreateConversation = useCallback(async () => {
    try {
      const conversationId = await createConversation({
        spreadsheetId,
        title: `Chat ${(conversations?.length || 0) + 1}`,
      });
      setCurrentConversationId(conversationId);
      toast.success("New conversation created");
    } catch (error) {
      console.error("Error creating conversation:", error);
      toast.error("Failed to create conversation");
    }
  }, [createConversation, spreadsheetId, conversations?.length]);

  // Focus input when sidebar opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Create first conversation if none exist
  useEffect(() => {
    if (conversations && conversations.length === 0 && !currentConversationId) {
      handleCreateConversation();
    }
  }, [conversations, currentConversationId, handleCreateConversation]);

  // Set default agent when agents are loaded
  useEffect(() => {
    if (agents && agents.length > 0 && !selectedAgentId) {
      const defaultAgent = agents.find(agent => agent.isActive) || agents[0];
      setSelectedAgentId(defaultAgent._id);
    } else if (agents && agents.length === 0 && !selectedAgentId) {
      // Create default agents if none exist
      getDefaultAgents().then((defaultAgents) => {
        if (defaultAgents && defaultAgents.length > 0) {
          const firstAgent = defaultAgents.find((agent: any) => agent.isActive) || defaultAgents[0];
          setSelectedAgentId(firstAgent._id);
        }
      }).catch(console.error);
    }
  }, [agents, selectedAgentId, getDefaultAgents]);

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !currentConversationId || isLoading) return;

    const message = messageInput.trim();
    setMessageInput("");
    setIsLoading(true);

    try {
      // Use database data if available, otherwise use frontend data
      const liveData = getSheetData?.data || JSON.stringify(sheetData);
      
      await sendMessage({
        conversationId: currentConversationId,
        content: message,
        selectedRange,
        activeSheetName,
        liveSpreadsheetData: liveData,
        agentId: selectedAgentId || undefined,
      });
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteConversation = async (conversationId: Id<"aiConversations">) => {
    try {
      await deleteConversation({ conversationId });
      if (currentConversationId === conversationId) {
        setCurrentConversationId(null);
      }
      toast.success("Conversation deleted");
    } catch (error) {
      console.error("Error deleting conversation:", error);
      toast.error("Failed to delete conversation");
    }
  };

  const extractTablesUsingAI = async (text: string): Promise<any[]> => {
    try {
      console.log("Calling server API for table extraction...");
      
      const response = await fetch("/api/extract-tables", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: text.substring(0, 8000) }),
      });

      if (!response.ok) {
        console.error("API error:", response.status);
        return [];
      }

      const data = await response.json();
      console.log("API response:", data);
      
      if (data.tables && Array.isArray(data.tables)) {
        console.log(`AI extracted ${data.tables.length} tables`);
        return data.tables;
      }
      
      return [];
    } catch (error) {
      console.error("Error in AI table extraction:", error);
      return [];
    }
  };

  const extractTextFromPDF = async (file: File): Promise<{ text: string; tables: any[] }> => {
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
    
    // Set worker source to match the installed version
    const pdfjsVersion = pdfjsLib.version || "5.4.296";
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsVersion}/legacy/build/pdf.worker.min.mjs`;
    
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    let fullText = "";
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(" ");
      
      fullText += pageText + "\n\n";
    }
    
    // Use AI to extract tables from the full text
    console.log("Extracting tables using AI...");
    const aiTables = await extractTablesUsingAI(fullText);
    
    return { text: fullText.trim(), tables: aiTables };
  };

  const extractTextFromDOCX = async (file: File): Promise<{ text: string; tables: any[] }> => {
    const mammoth = await import("mammoth");
    const arrayBuffer = await file.arrayBuffer();
    
    const result = await mammoth.extractRawText({ arrayBuffer });
    const text = result.value;
    
    // Use AI to extract tables from the text
    console.log("Extracting tables from DOCX using AI...");
    const aiTables = await extractTablesUsingAI(text);
    
    return { text: text.trim(), tables: aiTables };
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (!validTypes.includes(file.type)) {
      toast.error("Only PDF and DOCX files are supported");
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB");
      return;
    }

    setIsUploadingFile(true);
    try {
      toast.info("Extracting text from document...");
      
      // Extract text and tables from document
      let extractedText = "";
      let extractedTables: any[] = [];
      
      if (file.type === "application/pdf") {
        toast.info("Using AI to detect tables in PDF...");
        const result = await extractTextFromPDF(file);
        extractedText = result.text;
        extractedTables = result.tables;
        console.log(`PDF extraction complete: ${result.text.length} chars, ${result.tables.length} tables found`);
        result.tables.forEach((table, idx) => {
          console.log(`Table ${idx + 1}: ${table.rows.length} rows, ${table.rows[0]?.length || 0} columns`);
          console.log("Sample data:", table.rows[0]);
        });
        
        if (result.tables.length > 0) {
          toast.success(`Found ${result.tables.length} table(s) in PDF!`);
        }
      } else {
        toast.info("Using AI to detect tables in DOCX...");
        const result = await extractTextFromDOCX(file);
        extractedText = result.text;
        extractedTables = result.tables;
        console.log(`DOCX extraction complete: ${result.text.length} chars, ${result.tables.length} tables found`);
        result.tables.forEach((table, idx) => {
          console.log(`Table ${idx + 1}: ${table.rows.length} rows, ${table.rows[0]?.length || 0} columns`);
          console.log("Sample data:", table.rows[0]);
        });
        
        if (result.tables.length > 0) {
          toast.success(`Found ${result.tables.length} table(s) in DOCX!`);
        }
      }
      
      console.log("Extracted tables:", extractedTables);
      toast.info("Uploading document...");
      
      // Get upload URL
      const uploadUrl = await generateUploadUrl();

      // Upload file
      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload file");
      }

      const { storageId } = await uploadResponse.json();

      // Create document record with extracted content
      await createDocument({
        spreadsheetId,
        conversationId: currentConversationId || undefined,
        fileName: file.name,
        fileType: file.type === "application/pdf" ? "pdf" : "docx",
        storageId,
        extractedText,
        extractedTables: JSON.stringify(extractedTables),
      });

      toast.success(`Document "${file.name}" uploaded and processed successfully!`);
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      console.error("Error uploading file:", error);
      toast.error(`Failed to process document: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsUploadingFile(false);
    }
  };

  const handleDeleteDocument = async (documentId: Id<"documents">) => {
    try {
      await deleteDocument({ documentId });
      toast.success("Document deleted");
    } catch (error) {
      console.error("Error deleting document:", error);
      toast.error("Failed to delete document");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Resize functionality
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;
    
    const newWidth = window.innerWidth - e.clientX;
    const minWidth = 300;
    const maxWidth = 800;
    
    if (newWidth >= minWidth && newWidth <= maxWidth) {
      setSidebarWidth(newWidth);
    }
  }, [isResizing]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  if (!isOpen) {
    // When the sidebar is closed, don't render an extra AI button here.
    // The toolbar in the page handles the toggle button to avoid duplicates.
    return null;
  }

  return (
    <div 
      ref={sidebarRef}
      className="fixed top-0 right-0 h-full bg-white border-l shadow-lg z-50 flex flex-col" 
      style={{ width: `${sidebarWidth}px` }}
    >
      {/* Resize Handle */}
      <div
        className="absolute left-0 top-0 w-1 h-full cursor-col-resize hover:bg-blue-500 hover:w-2 transition-all"
        onMouseDown={handleMouseDown}
      >
        <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-1 h-8 bg-gray-300 rounded-r"></div>
      </div>

      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4" />
          <span className="font-medium">AI Assistant</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={onToggle}
          title="Close AI Assistant"
        >
          <X className="w-3 h-3" />
        </Button>
      </div>

      {/* Agent Selection */}
      <div className="p-4 border-b flex-shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <Settings className="w-3 h-3" />
          <span className="text-sm font-medium">AI Model</span>
        </div>
        <Select
          value={selectedAgentId || ""}
          onValueChange={(value) => setSelectedAgentId(value as Id<"aiAgents">)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select AI model" />
          </SelectTrigger>
          <SelectContent>
            {agents?.map((agent) => (
              <SelectItem key={agent._id} value={agent._id}>
                <div className="flex flex-col">
                  <span className="font-medium">{agent.name}</span>
                  <span className="text-xs text-gray-500">{agent.description}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Conversations List */}
        <div className="p-4 border-b flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Conversations</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={handleCreateConversation}
              title="New conversation"
            >
              <Plus className="w-3 h-3" />
            </Button>
          </div>
          
          <ScrollArea className="h-24">
            <div className="space-y-1">
              {conversations?.map((conversation) => (
                <div
                  key={conversation._id}
                  className={`flex items-center justify-between p-2 rounded cursor-pointer hover:bg-gray-100 group ${
                    currentConversationId === conversation._id ? "bg-blue-50" : ""
                  }`}
                  onClick={() => setCurrentConversationId(conversation._id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {conversation.title}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatTime(conversation.updatedAt)}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteConversation(conversation._id);
                    }}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Messages */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-4">
              {messages?.map((message) => (
                <div
                  key={message._id}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg p-3 ${
                      message.role === "user"
                        ? "bg-blue-500 text-white"
                        : "bg-gray-100 text-gray-900"
                    }`}
                  >
                    <div className="text-sm break-words">
                      {message.role === "assistant" ? (
                        <div className="prose prose-sm max-w-none">
                          <ReactMarkdown
                            components={{
                              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                              strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
                              em: ({ children }) => <em className="italic text-gray-700">{children}</em>,
                              ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                              ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                              li: ({ children }) => <li className="text-sm">{children}</li>,
                              h1: ({ children }) => <h1 className="text-lg font-bold mb-2 text-gray-900">{children}</h1>,
                              h2: ({ children }) => <h2 className="text-base font-bold mb-2 text-gray-900">{children}</h2>,
                              h3: ({ children }) => <h3 className="text-sm font-bold mb-1 text-gray-900">{children}</h3>,
                              code: ({ children }) => <code className="bg-gray-100 px-1 py-0.5 rounded text-xs font-mono">{children}</code>,
                              pre: ({ children }) => <pre className="bg-gray-100 p-2 rounded text-xs font-mono overflow-x-auto mb-2">{children}</pre>,
                              blockquote: ({ children }) => <blockquote className="border-l-4 border-gray-300 pl-3 italic text-gray-600 mb-2">{children}</blockquote>,
                            }}
                          >
                            {message.content}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap">{message.content}</div>
                      )}
                    </div>
                    
                    {/* Chart in AI response */}
                    {message.chartData && (
                      <div className="mt-3">
                        <div className="text-xs opacity-75 mb-2">
                          Generated Chart:
                        </div>
                        <div className="bg-white rounded border p-2">
                          <ChartJSFromRange
                            sheetData={sheetData}
                            range={message.chartData.range}
                            type={message.chartData.type}
                            title={message.chartData.title}
                            sheetName={message.chartData.sheetName || activeSheetName}
                            showViewDownload={false}
                          />
                        </div>
                      </div>
                    )}
                    
                    <div className="text-xs opacity-75 mt-1 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span>{formatTime(message.createdAt)}</span>
                        {message.isStreaming && !message.isComplete && (
                          <div className="flex items-center gap-1">
                            <div className="animate-pulse w-1 h-1 bg-blue-500 rounded-full"></div>
                            <div className="animate-pulse w-1 h-1 bg-blue-500 rounded-full" style={{ animationDelay: '0.2s' }}></div>
                            <div className="animate-pulse w-1 h-1 bg-blue-500 rounded-full" style={{ animationDelay: '0.4s' }}></div>
                            {/* <span className="text-blue-600">Streaming...</span> */}
                          </div>
                        )}
                        {/* Debug info - remove after testing */}
                        {process.env.NODE_ENV === 'development' && (
                          <div className="text-xs text-gray-400">
                            {message.isStreaming ? 'S' : 'N'} {message.isComplete ? 'C' : 'N'}
                          </div>
                        )}
                      </div>
                      {message.provider && message.modelName && (
                        <span className="text-xs bg-gray-200 px-1 rounded">
                          {message.provider}/{message.modelName}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-600"></div>
                      <span className="text-sm text-gray-600">AI is thinking...</span>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Show streaming indicator if there's an active streaming message */}
              {messages?.some(msg => msg.isStreaming && !msg.isComplete) && !isLoading && (
                <div className="flex justify-start">
                  <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                    {/* <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <div className="animate-pulse w-1 h-1 bg-blue-500 rounded-full"></div>
                        <div className="animate-pulse w-1 h-1 bg-blue-500 rounded-full" style={{ animationDelay: '0.2s' }}></div>
                        <div className="animate-pulse w-1 h-1 bg-blue-500 rounded-full" style={{ animationDelay: '0.4s' }}></div>
                      </div>
                      <span className="text-sm text-blue-600">AI is responding...</span>
                    </div> */}
                    {/* Debug info - remove after testing */}
                    {process.env.NODE_ENV === 'development' && (
                      <div className="text-xs text-gray-400 mt-1">
                        Debug: {messages?.filter(msg => msg.isStreaming && !msg.isComplete).length} streaming messages
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Uploaded Documents */}
          {documents && documents.length > 0 && (
            <div className="px-4 py-2 border-t bg-gray-50">
              <div className="text-xs font-medium text-gray-600 mb-2">
                Uploaded Documents ({documents.length})
              </div>
              <div className="flex flex-wrap gap-2">
                {documents.map((doc: { _id: Id<"documents">; fileName: string }) => (
                  <div
                    key={doc._id}
                    className="flex items-center gap-1 px-2 py-1 bg-white rounded border text-xs"
                  >
                    <FileText className="w-3 h-3 text-gray-500" />
                    <span className="max-w-[120px] truncate" title={doc.fileName}>
                      {doc.fileName}
                    </span>
                    <button
                      onClick={() => handleDeleteDocument(doc._id)}
                      className="text-gray-400 hover:text-red-600"
                      title="Delete document"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="p-4 border-t flex-shrink-0">
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingFile || !currentConversationId}
                title="Upload PDF or DOCX"
              >
                <Paperclip className={`w-4 h-4 ${isUploadingFile ? 'animate-spin' : ''}`} />
              </Button>
              <Input
                ref={inputRef}
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask AI about your spreadsheet..."
                disabled={isLoading || !currentConversationId}
                className="flex-1"
              />
              <Button
                onClick={handleSendMessage}
                disabled={!messageInput.trim() || isLoading || !currentConversationId}
                size="sm"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
            
            {/* Context info */}
            {(selectedRange || activeSheetName) && (
              <div className="mt-2 text-xs text-gray-500">
                Context: {activeSheetName && `Sheet: ${activeSheetName}`}
                {selectedRange && ` | Range: ${selectedRange}`}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
