import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Ticket, TicketMessage } from "@shared/schema";
import { useState } from "react";
import { MessageCircle, Clock, User, CheckCircle, XCircle } from "lucide-react";

export default function Tickets() {
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  const { data: tickets, isLoading } = useQuery<Ticket[]>({
    queryKey: ["/api/tickets"],
  });

  const { data: messages } = useQuery<TicketMessage[]>({
    queryKey: ["/api/tickets", selectedTicket?.id, "messages"],
    enabled: !!selectedTicket,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a1614] text-[#f5f1e8] flex items-center justify-center">
        <p className="text-[#9ca3af]">Loading tickets...</p>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open":
        return "bg-green-500/20 text-green-400";
      case "claimed":
        return "bg-blue-500/20 text-blue-400";
      case "closed":
        return "bg-red-500/20 text-red-400";
      default:
        return "bg-gray-500/20 text-gray-400";
    }
  };

  return (
    <div className="min-h-screen bg-[#0a1614] text-[#f5f1e8]">
      <header className="border-b border-[#1a2e2a]/50 bg-[#0a1614]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <span className="text-lg sm:text-xl font-bold tracking-tight" data-testid="text-logo">
              Hourglass Tickets
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <Card className="p-4 bg-[#0f1f1b] border-[#1a2e2a]">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-[#3dd9b3]" />
                All Tickets ({tickets?.length || 0})
              </h2>
              
              <ScrollArea className="h-[600px]">
                <div className="space-y-2">
                  {tickets?.map((ticket) => (
                    <Card
                      key={ticket.id}
                      className={`p-4 cursor-pointer hover-elevate active-elevate-2 border-[#1a2e2a] ${
                        selectedTicket?.id === ticket.id ? "bg-[#1a2e2a]" : "bg-[#0a1614]"
                      }`}
                      onClick={() => setSelectedTicket(ticket)}
                      data-testid={`ticket-card-${ticket.id}`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <span className="font-bold text-[#3dd9b3]">#{ticket.ticketNumber}</span>
                        <Badge className={getStatusColor(ticket.status)}>{ticket.status}</Badge>
                      </div>
                      
                      <p className="text-sm text-[#f5f1e8] mb-2">{ticket.category}</p>
                      
                      <div className="flex items-center gap-2 text-xs text-[#9ca3af]">
                        <User className="w-3 h-3" />
                        <span>{ticket.username}</span>
                      </div>
                      
                      <div className="flex items-center gap-2 text-xs text-[#9ca3af] mt-1">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(ticket.createdAt).toLocaleDateString()}</span>
                      </div>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </Card>
          </div>

          <div className="lg:col-span-2">
            {selectedTicket ? (
              <Card className="p-6 bg-[#0f1f1b] border-[#1a2e2a]">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold mb-2">
                      Ticket #{selectedTicket.ticketNumber}
                    </h2>
                    <div className="flex items-center gap-3 text-sm text-[#9ca3af]">
                      <span className="flex items-center gap-1">
                        <User className="w-4 h-4" />
                        {selectedTicket.username}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {new Date(selectedTicket.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <Badge className={getStatusColor(selectedTicket.status)}>
                    {selectedTicket.status}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-[#0a1614] rounded-lg border border-[#1a2e2a]">
                  <div>
                    <p className="text-xs text-[#9ca3af] mb-1">Category</p>
                    <p className="font-semibold">{selectedTicket.category}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#9ca3af] mb-1">Topic</p>
                    <p className="font-semibold">{selectedTicket.topic}</p>
                  </div>
                  {selectedTicket.claimedByUsername && (
                    <div>
                      <p className="text-xs text-[#9ca3af] mb-1">Claimed By</p>
                      <p className="font-semibold">{selectedTicket.claimedByUsername}</p>
                    </div>
                  )}
                  {selectedTicket.closedAt && (
                    <div>
                      <p className="text-xs text-[#9ca3af] mb-1">Closed At</p>
                      <p className="font-semibold">
                        {new Date(selectedTicket.closedAt).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>

                <div className="mb-6">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <MessageCircle className="w-5 h-5 text-[#3dd9b3]" />
                    Conversation
                  </h3>
                  
                  <ScrollArea className="h-[400px] p-4 bg-[#0a1614] rounded-lg border border-[#1a2e2a]">
                    <div className="space-y-4">
                      {messages?.map((message) => (
                        <div
                          key={message.id}
                          className={`p-3 rounded-lg ${
                            message.userId === "SYSTEM"
                              ? "bg-[#3dd9b3]/10 border-l-4 border-[#3dd9b3]"
                              : "bg-[#0f1f1b]"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-sm">
                              {message.username}
                            </span>
                            <span className="text-xs text-[#9ca3af]">
                              {new Date(message.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-sm text-[#f5f1e8]">{message.content}</p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>

                <div className="flex gap-2">
                  {selectedTicket.status === "open" && (
                    <Button
                      className="bg-[#3dd9b3] text-[#0a1614] hover:bg-[#5ce1d7]"
                      data-testid="button-close-ticket"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Close Ticket
                    </Button>
                  )}
                  {selectedTicket.status === "closed" && (
                    <Badge className="bg-red-500/20 text-red-400 px-4 py-2">
                      <XCircle className="w-4 h-4 mr-2" />
                      Ticket Closed
                    </Badge>
                  )}
                </div>
              </Card>
            ) : (
              <Card className="p-12 bg-[#0f1f1b] border-[#1a2e2a] flex items-center justify-center">
                <div className="text-center text-[#9ca3af]">
                  <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg">Select a ticket to view details</p>
                </div>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
