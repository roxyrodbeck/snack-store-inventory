"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, ShoppingCart } from "lucide-react"
import { supabase, isDemoMode } from "@/lib/supabase"

export default function LoginPage() {
  const [employeeId, setEmployeeId] = useState("")
  const [startingCash, setStartingCash] = useState("")
  const [closingCash, setClosingCash] = useState("")
  const [role, setRole] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isDemoModeState, setIsDemoMode] = useState(isDemoMode())

  const handleLogin = async () => {
    if (!employeeId) return

    setIsLoading(true)

    try {
      if (isDemoModeState) {
        // Demo mode - just store locally and redirect
        localStorage.setItem("employeeId", employeeId)
        localStorage.setItem("role", role || "general")
        localStorage.setItem("demoMode", "true")
        window.location.href = "/dashboard"
        return
      }

      // Get the single cash register record
      const { data: cashRegister, error: fetchError } = await supabase.from("cash_register").select("*").single()

      if (fetchError) {
        console.error("Error fetching cash register:", fetchError)
        // If no cash register exists, create one
        if (fetchError.code === "PGRST116") {
          const { error: createError } = await supabase
            .from("cash_register")
            .insert([{ current_amount: 0, starting_amount: 0, updated_by: "system" }])

          if (createError) {
            console.error("Error creating cash register:", createError)
            alert("Error setting up cash register. Please try again.")
            setIsLoading(false)
            return
          }

          // Try to fetch again
          const { data: newCashRegister, error: newFetchError } = await supabase
            .from("cash_register")
            .select("*")
            .single()

          if (newFetchError) {
            console.error("Error fetching new cash register:", newFetchError)
            alert("Error accessing cash register. Please try again.")
            setIsLoading(false)
            return
          }

          // Use the newly created cash register
          await updateCashRegister(newCashRegister)
        } else {
          alert("Error accessing cash register. Please try again.")
          setIsLoading(false)
          return
        }
      } else {
        await updateCashRegister(cashRegister)
      }

      // Store employee info locally
      localStorage.setItem("employeeId", employeeId)
      localStorage.setItem("role", role || "general")
      localStorage.removeItem("demoMode")

      window.location.href = "/dashboard"
    } catch (error) {
      console.error("Login error:", error)
      alert("Login failed. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const updateCashRegister = async (cashRegister: any) => {
    // Update cash register if opener or closer
    if (role === "opener" && startingCash) {
      const { error } = await supabase
        .from("cash_register")
        .update({
          current_amount: Number.parseFloat(startingCash),
          starting_amount: Number.parseFloat(startingCash),
          updated_by: employeeId,
        })
        .eq("id", cashRegister.id)

      if (error) {
        console.error("Error updating cash register:", error)
        throw new Error("Error updating cash register")
      }
    } else if (role === "closer" && closingCash) {
      const { error } = await supabase
        .from("cash_register")
        .update({
          current_amount: Number.parseFloat(closingCash),
          updated_by: employeeId,
        })
        .eq("id", cashRegister.id)

      if (error) {
        console.error("Error updating cash register:", error)
        throw new Error("Error updating cash register")
      }
    }
  }

  const handleRoleClick = (selectedRole: string) => {
    if (role === selectedRole) {
      setRole("")
    } else {
      setRole(selectedRole)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Demo Mode Notice */}
        {isDemoModeState && (
          <Card className="mb-4 border-amber-200 bg-amber-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600" />
                <div>
                  <h3 className="font-semibold text-amber-800">Demo Mode</h3>
                  <p className="text-sm text-amber-700">
                    Supabase is not configured. All data will be simulated and reset on page refresh.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-teal-200 shadow-xl">
          <CardHeader className="text-center bg-teal-600 text-white rounded-t-lg">
            <div className="mb-2 flex items-center justify-center gap-2">
              <ShoppingCart className="h-6 w-6" />
              <CardTitle className="text-2xl font-bold">The Snack Track</CardTitle>
            </div>
            <p className="text-teal-100">School Snack Inventory System</p>
            {isDemoModeState && (
              <Badge variant="secondary" className="bg-amber-500 text-amber-900 mt-2">
                Demo Mode
              </Badge>
            )}
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="employeeId" className="text-slate-700 font-medium">
                Employee ID Number
              </Label>
              <Input
                id="employeeId"
                type="text"
                placeholder="Enter your ID number"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                className="border-teal-200 focus:border-teal-500 focus:ring-teal-500"
                disabled={isLoading}
              />
            </div>

            {!isDemoModeState && (
              <>
                <div className="space-y-3">
                  <Label className="text-slate-700 font-medium">Shift Type (Optional)</Label>
                  <div className="flex gap-4">
                    <div
                      className="flex items-center space-x-2 cursor-pointer hover:bg-teal-50 p-2 rounded"
                      onClick={() => !isLoading && handleRoleClick("opener")}
                    >
                      <input
                        type="radio"
                        id="opener"
                        name="role"
                        value="opener"
                        checked={role === "opener"}
                        onChange={() => {}}
                        className="text-teal-600 focus:ring-teal-500 pointer-events-none"
                        disabled={isLoading}
                      />
                      <Label htmlFor="opener" className="text-slate-700 cursor-pointer">
                        Opener
                      </Label>
                    </div>
                    <div
                      className="flex items-center space-x-2 cursor-pointer hover:bg-teal-50 p-2 rounded"
                      onClick={() => !isLoading && handleRoleClick("closer")}
                    >
                      <input
                        type="radio"
                        id="closer"
                        name="role"
                        value="closer"
                        checked={role === "closer"}
                        onChange={() => {}}
                        className="text-teal-600 focus:ring-teal-500 pointer-events-none"
                        disabled={isLoading}
                      />
                      <Label htmlFor="closer" className="text-slate-700 cursor-pointer">
                        Closer
                      </Label>
                    </div>
                  </div>
                </div>

                {role === "opener" && (
                  <div className="space-y-2">
                    <Label htmlFor="startingCash" className="text-slate-700 font-medium">
                      Starting Cash Amount ($)
                    </Label>
                    <Input
                      id="startingCash"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={startingCash}
                      onChange={(e) => setStartingCash(e.target.value)}
                      className="border-teal-200 focus:border-teal-500 focus:ring-teal-500"
                      disabled={isLoading}
                    />
                  </div>
                )}

                {role === "closer" && (
                  <div className="space-y-2">
                    <Label htmlFor="closingCash" className="text-slate-700 font-medium">
                      Closing Cash Amount ($)
                    </Label>
                    <Input
                      id="closingCash"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={closingCash}
                      onChange={(e) => setClosingCash(e.target.value)}
                      className="border-teal-200 focus:border-teal-500 focus:ring-teal-500"
                      disabled={isLoading}
                    />
                  </div>
                )}
              </>
            )}

            <Button
              onClick={handleLogin}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white font-medium py-2"
              disabled={!employeeId || isLoading}
            >
              {isLoading ? "Starting Shift..." : isDemoModeState ? "Start Demo" : "Start Shift"}
            </Button>

            {isDemoModeState && (
              <div className="text-center text-sm text-slate-600 bg-slate-50 p-3 rounded-lg">
                <p className="font-medium mb-1">Demo Mode Features:</p>
                <ul className="text-xs space-y-1">
                  <li>• All data is simulated</li>
                  <li>• Changes reset on page refresh</li>
                  <li>• No database connection required</li>
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
