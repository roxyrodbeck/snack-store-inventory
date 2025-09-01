"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Edit } from "lucide-react"
import { supabase } from "@/lib/supabase"

interface CashRegisterManagerProps {
  currentCash: number
  onCashUpdate: (newAmount: number) => void
}

export function CashRegisterManager({ currentCash, onCashUpdate }: CashRegisterManagerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [newAmount, setNewAmount] = useState("")
  const [isUpdating, setIsUpdating] = useState(false)
  const [employeeId, setEmployeeId] = useState("")

  useEffect(() => {
    const id = localStorage.getItem("employeeId") || ""
    setEmployeeId(id)
  }, [])

  const handleUpdateCash = async () => {
    if (!newAmount || isNaN(Number(newAmount))) return

    setIsUpdating(true)

    try {
      const { data: cashRegister, error: fetchError } = await supabase.from("cash_register").select("id").single()

      if (fetchError) throw fetchError

      const { error: updateError } = await supabase
        .from("cash_register")
        .update({
          current_amount: Number.parseFloat(newAmount),
          updated_by: employeeId,
        })
        .eq("id", cashRegister.id)

      if (updateError) throw updateError

      onCashUpdate(Number.parseFloat(newAmount))
      setIsOpen(false)
      setNewAmount("")
      alert("Cash register updated successfully!")
    } catch (error) {
      console.error("Error updating cash register:", error)
      alert("Error updating cash register. Please try again.")
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="ml-2 bg-transparent">
          <Edit className="h-4 w-4 mr-1" />
          Adjust Cash
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Update Cash Register</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-center p-4 bg-slate-50 rounded-lg">
            <p className="text-sm text-slate-600 mb-1">Current Amount</p>
            <p className="text-2xl font-bold text-slate-800">${currentCash.toFixed(2)}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="newAmount">New Cash Amount ($)</Label>
            <Input
              id="newAmount"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              className="border-teal-200 focus:border-teal-500 focus:ring-teal-500"
              autoFocus
            />
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleUpdateCash}
              className="flex-1 bg-teal-600 hover:bg-teal-700"
              disabled={isUpdating || !newAmount}
            >
              {isUpdating ? "Updating..." : "Update Cash"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setIsOpen(false)
                setNewAmount("")
              }}
              disabled={isUpdating}
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
