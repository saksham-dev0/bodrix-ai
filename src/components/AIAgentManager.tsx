"use client";

import React, { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Edit,
  Trash2,
  Bot,
  Settings,
} from "lucide-react";
import { toast } from "sonner";

interface AIAgentManagerProps {
  spreadsheetId: Id<"spreadsheets">;
}

export default function AIAgentManager({ spreadsheetId }: AIAgentManagerProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Id<"aiAgents"> | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    provider: "openai" as "openai" | "anthropic" | "google" | "mistral",
    modelName: "",
    systemPrompt: "",
  });

  // Convex queries and mutations
  const agents = useQuery(api.aiAgents.getAgents, {});
  const getDefaultAgents = useMutation(api.aiAgents.getDefaultAgents);
  const createAgent = useMutation(api.aiAgents.createAgent);
  const updateAgent = useMutation(api.aiAgents.updateAgent);
  const deleteAgent = useMutation(api.aiAgents.deleteAgent);

  const handleCreateAgent = async () => {
    try {
      await createAgent(formData);
      setIsCreateDialogOpen(false);
      setFormData({
        name: "",
        description: "",
        provider: "openai",
        modelName: "",
        systemPrompt: "",
      });
      toast.success("AI agent created successfully");
    } catch (error) {
      console.error("Error creating agent:", error);
      toast.error("Failed to create AI agent");
    }
  };

  const handleUpdateAgent = async () => {
    if (!editingAgent) return;
    
    try {
      await updateAgent({
        agentId: editingAgent,
        ...formData,
      });
      setIsEditDialogOpen(false);
      setEditingAgent(null);
      setFormData({
        name: "",
        description: "",
        provider: "openai",
        modelName: "",
        systemPrompt: "",
      });
      toast.success("AI agent updated successfully");
    } catch (error) {
      console.error("Error updating agent:", error);
      toast.error("Failed to update AI agent");
    }
  };

  const handleDeleteAgent = async (agentId: Id<"aiAgents">) => {
    try {
      await deleteAgent({ agentId });
      toast.success("AI agent deleted successfully");
    } catch (error) {
      console.error("Error deleting agent:", error);
      toast.error("Failed to delete AI agent");
    }
  };

  const handleEditAgent = (agent: any) => {
    setEditingAgent(agent._id);
    setFormData({
      name: agent.name,
      description: agent.description || "",
      provider: agent.provider,
      modelName: agent.modelName,
      systemPrompt: agent.systemPrompt,
    });
    setIsEditDialogOpen(true);
  };

  // Create default agents if none exist
  React.useEffect(() => {
    if (agents && agents.length === 0) {
      getDefaultAgents().catch(console.error);
    }
  }, [agents, getDefaultAgents]);

  const getProviderColor = (provider: string) => {
    switch (provider) {
      case "openai":
        return "bg-green-100 text-green-800";
      case "anthropic":
        return "bg-blue-100 text-blue-800";
      case "google":
        return "bg-red-100 text-red-800";
      case "mistral":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getModelSuggestions = (provider: string) => {
    switch (provider) {
      case "openai":
        return ["gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo"];
      case "anthropic":
        return ["claude-3-5-sonnet-20241022", "claude-3-haiku-20240307", "claude-3-opus-20240229"];
      case "google":
        return ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-pro"];
      case "mistral":
        return ["mistral-large-latest", "mistral-medium-latest", "mistral-small-latest"];
      default:
        return [];
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5" />
          <h3 className="text-lg font-semibold">AI Agents</h3>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Create Agent
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create AI Agent</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Name</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., GPT-4o Assistant"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of the agent"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Provider</label>
                <Select
                  value={formData.provider}
                  onValueChange={(value) => setFormData({ ...formData, provider: value as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="anthropic">Anthropic</SelectItem>
                    <SelectItem value="google">Google</SelectItem>
                    <SelectItem value="mistral">Mistral</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Model Name</label>
                <Select
                  value={formData.modelName}
                  onValueChange={(value) => setFormData({ ...formData, modelName: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    {getModelSuggestions(formData.provider).map((model) => (
                      <SelectItem key={model} value={model}>
                        {model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">System Prompt</label>
                <Textarea
                  value={formData.systemPrompt}
                  onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
                  placeholder="Enter the system prompt for this agent..."
                  rows={4}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateAgent}>Create Agent</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {agents?.map((agent) => (
          <div key={agent._id} className="border rounded-lg p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium">{agent.name}</h4>
                  <Badge className={getProviderColor(agent.provider)}>
                    {agent.provider}
                  </Badge>
                  {agent.isActive && (
                    <Badge variant="outline" className="text-green-600 border-green-600">
                      Active
                    </Badge>
                  )}
                </div>
                {agent.description && (
                  <p className="text-sm text-gray-600">{agent.description}</p>
                )}
                <p className="text-xs text-gray-500">Model: {agent.modelName}</p>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleEditAgent(agent)}
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteAgent(agent._id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
              <strong>System Prompt:</strong> {agent.systemPrompt}
            </div>
          </div>
        ))}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit AI Agent</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., GPT-4o Assistant"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of the agent"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Provider</label>
              <Select
                value={formData.provider}
                onValueChange={(value) => setFormData({ ...formData, provider: value as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="anthropic">Anthropic</SelectItem>
                  <SelectItem value="google">Google</SelectItem>
                  <SelectItem value="mistral">Mistral</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Model Name</label>
              <Select
                value={formData.modelName}
                onValueChange={(value) => setFormData({ ...formData, modelName: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {getModelSuggestions(formData.provider).map((model) => (
                    <SelectItem key={model} value={model}>
                      {model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">System Prompt</label>
              <Textarea
                value={formData.systemPrompt}
                onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
                placeholder="Enter the system prompt for this agent..."
                rows={4}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateAgent}>Update Agent</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
