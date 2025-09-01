"use client"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Package, Coffee, Zap } from 'lucide-react' // Add these to your existing lucide imports
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, ShoppingCart, Plus, Minus, DollarSign, CreditCard } from "lucide-react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"

interface Product {
  id: string
  name: string
  price: number
  quantity: number
  category: string  // Add this line
  timeRestriction?: {
    startTime: string
    endTime: string
  }
  secondTimeRestriction?: {
    startTime: string
    endTime: string
  }
}

interface CartItem {
  product: Product
  quantity: number
}

const CATEGORIES = [
  { value: "chips", label: "Chips & Snacks", icon: Package, color: "bg-orange-100 text-orange-700" },
  { value: "drinks", label: "Drinks", icon: Coffee, color: "bg-blue-100 text-blue-700" },
  { value: "candy", label: "Candy & Sweets", icon: Zap, color: "bg-pink-100 text-pink-700" },
  { value: "other", label: "Other Items", icon: Package, color: "bg-gray-100 text-gray-700" },
]

export default function SalesPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [currentCash, setCurrentCash] = useState(0)
  const [employeeId, setEmployeeId] = useState("")
  const [currentTime, setCurrentTime] = useState(new Date())
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "school-cash">("cash")
  const [isLoading, setIsLoading] = useState(true)
  const [isProcessingSale, setIsProcessingSale] = useState(false)
  const [activeCategory, setActiveCategory] = useState("all")

  useEffect(() => {
    const id = localStorage.getItem("employeeId") || ""
    setEmployeeId(id)

    loadData()

    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000)

    // Set up real-time subscriptions
    const productsSubscription = supabase
      .channel("products-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => {
        loadProducts()
      })
      .subscribe()

    const cashSubscription = supabase
      .channel("cash-register-sales-updates")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "cash_register",
        },
        (payload) => {
          console.log("Cash register updated in sales:", payload.new)
          setCurrentCash(payload.new.current_amount || 0)
        },
      )
      .subscribe()

    return () => {
      clearInterval(timer)
      supabase.removeChannel(productsSubscription)
      supabase.removeChannel(cashSubscription)
    }
  }, [])

  const loadData = async () => {
    setIsLoading(true)
    await Promise.all([loadProducts(), loadCashRegister()])
    setIsLoading(false)
  }

  const loadProducts = async () => {
  try {
    const { data, error } = await supabase.from("products").select("*").order("category, name")

    if (error) throw error

    const formattedProducts: Product[] = data.map((product) => ({
      id: product.id,
      name: product.name,
      price: product.price,
      quantity: product.quantity,
      category: product.category || "other", // Add this line
      timeRestriction:
        product.time_restriction_start && product.time_restriction_end
          ? {
              startTime: product.time_restriction_start,
              endTime: product.time_restriction_end,
            }
          : undefined,
      secondTimeRestriction:
        product.second_time_restriction_start && product.second_time_restriction_end
          ? {
              startTime: product.second_time_restriction_start,
              endTime: product.second_time_restriction_end,
            }
          : undefined,
    }))

    setProducts(formattedProducts)
  } catch (error) {
    console.error("Error loading products:", error)
  }
}

  const loadCashRegister = async () => {
    try {
      const { data, error } = await supabase.from("cash_register").select("current_amount").single()

      if (error) {
        console.error("Error loading cash register:", error)
        return
      }

      setCurrentCash(data.current_amount || 0)
    } catch (error) {
      console.error("Error loading cash register:", error)
    }
  }

  const isProductAvailable = (product: Product) => {
    const now = currentTime.getHours() * 60 + currentTime.getMinutes()

    let firstPeriodAvailable = true
    if (product.timeRestriction) {
      const [startHour, startMin] = product.timeRestriction.startTime.split(":").map(Number)
      const [endHour, endMin] = product.timeRestriction.endTime.split(":").map(Number)
      const startTime = startHour * 60 + startMin
      const endTime = endHour * 60 + endMin
      firstPeriodAvailable = now >= startTime && now <= endTime
    }

    let secondPeriodAvailable = true
    if (product.secondTimeRestriction) {
      const [startHour, startMin] = product.secondTimeRestriction.startTime.split(":").map(Number)
      const [endHour, endMin] = product.secondTimeRestriction.endTime.split(":").map(Number)
      const startTime = startHour * 60 + startMin
      const endTime = endHour * 60 + endMin
      secondPeriodAvailable = now >= startTime && now <= endTime
    }

    if (!product.timeRestriction && !product.secondTimeRestriction) return true
    if (product.timeRestriction && !product.secondTimeRestriction) return firstPeriodAvailable
    if (!product.timeRestriction && product.secondTimeRestriction) return secondPeriodAvailable
    return firstPeriodAvailable || secondPeriodAvailable
  }

const getFilteredProducts = () => {
  const availableProducts = products.filter((p) => p.quantity > 0)
  if (activeCategory === "all") return availableProducts
  return availableProducts.filter((product) => product.category === activeCategory)
}

const getCategoryStats = (categoryValue: string) => {
  const categoryProducts = products.filter((p) => p.category === categoryValue && p.quantity > 0)
  return {
    total: categoryProducts.length,
    available: categoryProducts.filter((p) => isProductAvailable(p)).length,
  }
}

  const addToCart = (product: Product) => {
    const existingItem = cart.find((item) => item.product.id === product.id)
    if (existingItem) {
      if (existingItem.quantity < product.quantity) {
        setCart(cart.map((item) => (item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item)))
      }
    } else {
      setCart([...cart, { product, quantity: 1 }])
    }
  }

  const removeFromCart = (productId: string) => {
    const existingItem = cart.find((item) => item.product.id === productId)
    if (existingItem && existingItem.quantity > 1) {
      setCart(cart.map((item) => (item.product.id === productId ? { ...item, quantity: item.quantity - 1 } : item)))
    } else {
      setCart(cart.filter((item) => item.product.id !== productId))
    }
  }

  const cartTotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0)

  const completeSale = async () => {
    if (cart.length === 0) return

    setIsProcessingSale(true)

    try {
      // Get current cash register data
      const { data: cashRegisterData, error: cashFetchError } = await supabase
        .from("cash_register")
        .select("*")
        .single()

      if (cashFetchError) throw cashFetchError

      // Create sale record
      const saleData = {
        employee_id: employeeId,
        items: cart.map((item) => ({
          product: {
            id: item.product.id,
            name: item.product.name,
            price: item.product.price,
          },
          quantity: item.quantity,
        })),
        total: cartTotal,
        payment_method: paymentMethod,
      }

      const { error: saleError } = await supabase.from("sales").insert([saleData])

      if (saleError) throw saleError

      // Update product quantities
      for (const item of cart) {
        const newQuantity = item.product.quantity - item.quantity
        const { error: productError } = await supabase
          .from("products")
          .update({ quantity: newQuantity })
          .eq("id", item.product.id)

        if (productError) throw productError
      }

      // Update cash register only if payment method is cash
      if (paymentMethod === "cash") {
        const newCashAmount = cashRegisterData.current_amount + cartTotal
        const { error: cashError } = await supabase
          .from("cash_register")
          .update({
            current_amount: newCashAmount,
            updated_by: employeeId,
          })
          .eq("id", cashRegisterData.id)

        if (cashError) throw cashError

        // Update local state immediately
        setCurrentCash(newCashAmount)
      }

      // Clear cart and show success
      setCart([])
      const paymentText = paymentMethod === "cash" ? "Cash" : "School Cash"
      alert(`Sale completed! Total: $${cartTotal.toFixed(2)} (${paymentText})`)
    } catch (error) {
      console.error("Error completing sale:", error)
      alert("Error completing sale. Please try again.")
    } finally {
      setIsProcessingSale(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 to-slate-100 flex items-center justify-center">
        <Card className="p-6 text-center">
          <p className="text-slate-600">Loading sales page...</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-slate-100">
      {/* Header */}
      <header className="bg-teal-600 text-white shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm" className="text-white hover:bg-teal-700">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold">Make Sale</h1>
                <p className="text-teal-100">Process customer purchases by category</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-teal-100">Cash Register</p>
              <p className="text-2xl font-bold">${currentCash.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Products */}
          <div className="lg:col-span-2">
  <Card className="border-teal-200">
    <CardHeader>
      <CardTitle className="text-slate-800">Available Products</CardTitle>
    </CardHeader>
    <CardContent>
      <Tabs value={activeCategory} onValueChange={setActiveCategory} className="w-full">
        <TabsList className="grid w-full grid-cols-5 mb-6">
          <TabsTrigger value="all" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            All ({products.filter((p) => p.quantity > 0).length})
          </TabsTrigger>
          {CATEGORIES.map((category) => {
            const stats = getCategoryStats(category.value)
            const Icon = category.icon
            return (
              <TabsTrigger key={category.value} value={category.value} className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                {category.label.split(" ")[0]} ({stats.total})
              </TabsTrigger>
            )
          })}
        </TabsList>

        <TabsContent value="all">
          {getFilteredProducts().length === 0 ? (
            <p className="text-slate-500 text-center py-8">No products available for sale at this time.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {getFilteredProducts().map((product) => {
                const isAvailable = isProductAvailable(product)
                const canPurchase = isAvailable

                return (
                  <Card
                    key={product.id}
                    className={`border-slate-200 transition-all ${
                      canPurchase ? "hover:border-teal-300" : "opacity-50 bg-slate-50"
                    }`}
                  >
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className={`font-semibold ${canPurchase ? "text-slate-800" : "text-slate-500"}`}>
                            {product.name}
                          </h3>
                          <Badge
                            className={
                              CATEGORIES.find((c) => c.value === product.category)?.color ||
                              "bg-gray-100 text-gray-700"
                            }
                          >
                            {CATEGORIES.find((c) => c.value === product.category)?.label || product.category}
                          </Badge>
                        </div>
                        <div className="flex flex-col gap-1">
                          <Badge variant={product.quantity <= 5 ? "destructive" : "secondary"}>
                            {product.quantity} left
                          </Badge>
                          {!isAvailable && (
                            <Badge
                              variant="outline"
                              className="text-xs bg-amber-50 text-amber-700 border-amber-200"
                            >
                              Time Restricted
                            </Badge>
                          )}
                        </div>
                      </div>
                      <p className={`text-xl font-bold mb-3 ${canPurchase ? "text-teal-600" : "text-slate-400"}`}>
                        ${product.price.toFixed(2)}
                      </p>
                      {(product.timeRestriction || product.secondTimeRestriction) && (
                        <div className="mb-3 flex flex-wrap gap-1">
                          {product.timeRestriction && (
                            <Badge
                              variant={isAvailable ? "default" : "outline"}
                              className={!isAvailable ? "text-slate-500 bg-slate-100" : ""}
                            >
                              {product.timeRestriction.startTime} - {product.timeRestriction.endTime}
                            </Badge>
                          )}
                          {product.secondTimeRestriction && (
                            <Badge
                              variant={isAvailable ? "default" : "outline"}
                              className={!isAvailable ? "text-slate-500 bg-slate-100" : ""}
                            >
                              {product.secondTimeRestriction.startTime} - {product.secondTimeRestriction.endTime}
                            </Badge>
                          )}
                        </div>
                      )}
                      <Button
                        onClick={() => addToCart(product)}
                        className={`w-full ${
                          canPurchase
                            ? "bg-teal-600 hover:bg-teal-700"
                            : "bg-slate-300 text-slate-500 cursor-not-allowed"
                        }`}
                        disabled={
                          !canPurchase ||
                          cart.find((item) => item.product.id === product.id)?.quantity >= product.quantity ||
                          isProcessingSale
                        }
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        {!isAvailable ? "Not Available Now" : "Add to Cart"}
                      </Button>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        {CATEGORIES.map((category) => (
          <TabsContent key={category.value} value={category.value}>
            {getFilteredProducts().length === 0 ? (
              <p className="text-slate-500 text-center py-8">
                No {category.label.toLowerCase()} available for sale at this time.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {getFilteredProducts().map((product) => {
                  const isAvailable = isProductAvailable(product)
                  const canPurchase = isAvailable

                  return (
                    <Card
                      key={product.id}
                      className={`border-slate-200 transition-all ${
                        canPurchase ? "hover:border-teal-300" : "opacity-50 bg-slate-50"
                      }`}
                    >
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-3">
                          <h3 className={`font-semibold ${canPurchase ? "text-slate-800" : "text-slate-500"}`}>
                            {product.name}
                          </h3>
                          <div className="flex flex-col gap-1">
                            <Badge variant={product.quantity <= 5 ? "destructive" : "secondary"}>
                              {product.quantity} left
                            </Badge>
                            {!isAvailable && (
                              <Badge
                                variant="outline"
                                className="text-xs bg-amber-50 text-amber-700 border-amber-200"
                              >
                                Time Restricted
                              </Badge>
                            )}
                          </div>
                        </div>
                        <p className={`text-xl font-bold mb-3 ${canPurchase ? "text-teal-600" : "text-slate-400"}`}>
                          ${product.price.toFixed(2)}
                        </p>
                        {(product.timeRestriction || product.secondTimeRestriction) && (
                          <div className="mb-3 flex flex-wrap gap-1">
                            {product.timeRestriction && (
                              <Badge
                                variant={isAvailable ? "default" : "outline"}
                                className={!isAvailable ? "text-slate-500 bg-slate-100" : ""}
                              >
                                {product.timeRestriction.startTime} - {product.timeRestriction.endTime}
                              </Badge>
                            )}
                            {product.secondTimeRestriction && (
                              <Badge
                                variant={isAvailable ? "default" : "outline"}
                                className={!isAvailable ? "text-slate-500 bg-slate-100" : ""}
                              >
                                {product.secondTimeRestriction.startTime} - {product.secondTimeRestriction.endTime}
                              </Badge>
                            )}
                          </div>
                        )}
                        <Button
                          onClick={() => addToCart(product)}
                          className={`w-full ${
                            canPurchase
                              ? "bg-teal-600 hover:bg-teal-700"
                              : "bg-slate-300 text-slate-500 cursor-not-allowed"
                          }`}
                          disabled={
                            !canPurchase ||
                            cart.find((item) => item.product.id === product.id)?.quantity >= product.quantity ||
                            isProcessingSale
                          }
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          {!isAvailable ? "Not Available Now" : "Add to Cart"}
                        </Button>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </CardContent>
  </Card>
</div>

          {/* Cart */}
          <div>
            <Card className="border-teal-200 sticky top-6">
              <CardHeader>
                <CardTitle className="text-slate-800 flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  Shopping Cart ({cart.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {cart.length === 0 ? (
                  <p className="text-slate-500 text-center py-4">Cart is empty</p>
                ) : (
                  <div className="space-y-3">
                    {cart.map((item) => (
                      <div
                        key={item.product.id}
                        className="flex justify-between items-center p-3 bg-slate-50 rounded-lg"
                      >
                        <div className="flex-1">
                          <h4 className="font-medium text-slate-800">{item.product.name}</h4>
                          <p className="text-sm text-slate-600">${item.product.price.toFixed(2)} each</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => removeFromCart(item.product.id)}
                            disabled={isProcessingSale}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center font-medium">{item.quantity}</span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => addToCart(item.product)}
                            disabled={item.quantity >= item.product.quantity || isProcessingSale}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}

                    <div className="border-t pt-3 mt-4">
                      <div className="flex justify-between items-center text-lg font-bold mb-4">
                        <span>Total:</span>
                        <span className="text-teal-600">${cartTotal.toFixed(2)}</span>
                      </div>

                      {/* Payment Method Selection */}
                      <div className="space-y-3 mb-4">
                        <p className="text-sm font-medium text-slate-700">Payment Method:</p>
                        <div className="flex gap-2">
                          <Button
                            variant={paymentMethod === "cash" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setPaymentMethod("cash")}
                            className="flex-1"
                            disabled={isProcessingSale}
                          >
                            <DollarSign className="h-4 w-4 mr-1" />
                            Cash
                          </Button>
                          <Button
                            variant={paymentMethod === "school-cash" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setPaymentMethod("school-cash")}
                            className="flex-1"
                            disabled={isProcessingSale}
                          >
                            <CreditCard className="h-4 w-4 mr-1" />
                            School Cash
                          </Button>
                        </div>
                        {paymentMethod === "school-cash" && (
                          <p className="text-xs text-slate-500 bg-blue-50 p-2 rounded">
                            School Cash payments do not affect the cash register total
                          </p>
                        )}
                      </div>
                    </div>

                    <Button
                      onClick={completeSale}
                      className="w-full bg-slate-700 hover:bg-slate-800 text-white"
                      disabled={isProcessingSale}
                    >
                      {paymentMethod === "cash" ? (
                        <DollarSign className="h-4 w-4 mr-2" />
                      ) : (
                        <CreditCard className="h-4 w-4 mr-2" />
                      )}
                      {isProcessingSale
                        ? "Processing..."
                        : `Complete Sale (${paymentMethod === "cash" ? "Cash" : "School Cash"})`}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
