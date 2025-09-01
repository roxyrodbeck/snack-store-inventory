"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Plus, Edit, Trash2, TrendingUp, Package, Coffee, Zap } from "lucide-react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"

interface Product {
  id: string
  name: string
  price: number
  unitCost: number
  quantity: number
  category: string
  timeRestriction?: {
    startTime: string
    endTime: string
  }
  secondTimeRestriction?: {
    startTime: string
    endTime: string
  }
}

const CATEGORIES = [
  { value: "chips", label: "Chips & Snacks", icon: Package, color: "bg-orange-100 text-orange-700" },
  { value: "drinks", label: "Drinks", icon: Coffee, color: "bg-blue-100 text-blue-700" },
  { value: "candy", label: "Candy & Sweets", icon: Zap, color: "bg-pink-100 text-pink-700" },
  { value: "other", label: "Other Items", icon: Package, color: "bg-gray-100 text-gray-700" },
]

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [activeCategory, setActiveCategory] = useState("all")
  const [formData, setFormData] = useState({
    name: "",
    price: "",
    unitCost: "",
    quantity: "",
    category: "other",
    hasTimeRestriction: false,
    startTime: "",
    endTime: "",
    hasSecondTimeRestriction: false,
    secondStartTime: "",
    secondEndTime: "",
  })
  const [bulkCategorizeMode, setBulkCategorizeMode] = useState(false)
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set())
  const [bulkCategory, setBulkCategory] = useState("other")

  useEffect(() => {
    loadProducts()

    // Set up real-time subscription
    const subscription = supabase
      .channel("products-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => {
        loadProducts()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(subscription)
    }
  }, [])

  const loadProducts = async () => {
    try {
      // Try to load with category column first
      let { data, error } = await supabase.from("products").select("*").order("category, name")

      // If category column doesn't exist, load without it
      if (error && error.message?.includes("category")) {
        console.log("category column not found, loading without category data")
        const fallbackResult = await supabase
          .from("products")
          .select(
            "id, name, price, unit_cost, quantity, time_restriction_start, time_restriction_end, second_time_restriction_start, second_time_restriction_end",
          )
        data = fallbackResult.data
        error = fallbackResult.error
      }

      if (error) throw error

      const formattedProducts: Product[] = (data || []).map((product) => ({
        id: product.id,
        name: product.name,
        price: product.price,
        unitCost: product.unit_cost || 0,
        quantity: product.quantity,
        category: product.category || "other",
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
      alert("Error loading products. Please refresh the page.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)

    try {
      const productData = {
        name: formData.name,
        price: Number.parseFloat(formData.price),
        unit_cost: Number.parseFloat(formData.unitCost) || 0,
        quantity: Number.parseInt(formData.quantity),
        category: formData.category,
        time_restriction_start: formData.hasTimeRestriction ? formData.startTime : null,
        time_restriction_end: formData.hasTimeRestriction ? formData.endTime : null,
        second_time_restriction_start: formData.hasSecondTimeRestriction ? formData.secondStartTime : null,
        second_time_restriction_end: formData.hasSecondTimeRestriction ? formData.secondEndTime : null,
      }

      let error
      if (editingProduct) {
        const result = await supabase.from("products").update(productData).eq("id", editingProduct.id)
        error = result.error
      } else {
        const result = await supabase.from("products").insert([productData])
        error = result.error
      }

      if (error) throw error

      resetForm()
      alert(editingProduct ? "Product updated successfully!" : "Product added successfully!")
    } catch (error) {
      console.error("Error saving product:", error)
      alert("Error saving product. Please try again.")
    } finally {
      setIsSaving(false)
    }
  }

  const resetForm = () => {
    setFormData({
      name: "",
      price: "",
      unitCost: "",
      quantity: "",
      category: "other",
      hasTimeRestriction: false,
      startTime: "",
      endTime: "",
      hasSecondTimeRestriction: false,
      secondStartTime: "",
      secondEndTime: "",
    })
    setShowForm(false)
    setEditingProduct(null)
  }

  const handleEdit = (product: Product) => {
    setEditingProduct(product)
    setFormData({
      name: product.name,
      price: product.price.toString(),
      unitCost: product.unitCost.toString(),
      quantity: product.quantity.toString(),
      category: product.category,
      hasTimeRestriction: !!product.timeRestriction,
      startTime: product.timeRestriction?.startTime || "",
      endTime: product.timeRestriction?.endTime || "",
      hasSecondTimeRestriction: !!product.secondTimeRestriction,
      secondStartTime: product.secondTimeRestriction?.startTime || "",
      secondEndTime: product.secondTimeRestriction?.endTime || "",
    })
    setShowForm(true)
  }

  const handleDelete = async (productId: string) => {
    if (!confirm("Are you sure you want to delete this product?")) return

    try {
      const { error } = await supabase.from("products").delete().eq("id", productId)

      if (error) throw error
      alert("Product deleted successfully!")
    } catch (error) {
      console.error("Error deleting product:", error)
      alert("Error deleting product. Please try again.")
    }
  }

  const getFilteredProducts = () => {
    if (activeCategory === "all") return products
    return products.filter((product) => product.category === activeCategory)
  }

  const getCategoryStats = (categoryValue: string) => {
    const categoryProducts = products.filter((p) => p.category === categoryValue)
    return {
      total: categoryProducts.length,
      lowStock: categoryProducts.filter((p) => p.quantity <= 5).length,
      outOfStock: categoryProducts.filter((p) => p.quantity === 0).length,
    }
  }

  const getCategoryIcon = (categoryValue: string) => {
    const category = CATEGORIES.find((c) => c.value === categoryValue)
    return category ? category.icon : Package
  }

  const getCategoryColor = (categoryValue: string) => {
    const category = CATEGORIES.find((c) => c.value === categoryValue)
    return category ? category.color : "bg-gray-100 text-gray-700"
  }

  const handleProductSelect = (productId: string, checked: boolean) => {
    const newSelected = new Set(selectedProducts)
    if (checked) {
      newSelected.add(productId)
    } else {
      newSelected.delete(productId)
    }
    setSelectedProducts(newSelected)
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedProducts(new Set(products.map((p) => p.id)))
    } else {
      setSelectedProducts(new Set())
    }
  }

  const handleBulkCategorize = async () => {
    if (selectedProducts.size === 0) {
      alert("Please select at least one product to categorize.")
      return
    }

    setIsSaving(true)
    try {
      const updates = Array.from(selectedProducts).map((productId) =>
        supabase.from("products").update({ category: bulkCategory }).eq("id", productId),
      )

      await Promise.all(updates)

      setSelectedProducts(new Set())
      setBulkCategorizeMode(false)
      alert(`Successfully categorized ${selectedProducts.size} products!`)
    } catch (error) {
      console.error("Error bulk categorizing:", error)
      alert("Error categorizing products. Please try again.")
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 to-slate-100 flex items-center justify-center">
        <Card className="p-6 text-center">
          <p className="text-slate-600">Loading products...</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-slate-100">
      {/* Header */}
      <header className="bg-teal-600 text-white shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" className="text-white hover:bg-teal-700">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Product Management</h1>
              <p className="text-teal-100">Add and manage snack inventory by category</p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {/* Bulk Categorize and Add Product Buttons */}
        {!showForm && (
          <div className="mb-6 flex gap-3">
            <Button onClick={() => setShowForm(true)} className="bg-teal-600 hover:bg-teal-700">
              <Plus className="h-4 w-4 mr-2" />
              Add New Product
            </Button>
            <Button
              onClick={() => setBulkCategorizeMode(!bulkCategorizeMode)}
              variant={bulkCategorizeMode ? "destructive" : "outline"}
              className={bulkCategorizeMode ? "" : "border-teal-200 text-teal-700 hover:bg-teal-50"}
            >
              <Package className="h-4 w-4 mr-2" />
              {bulkCategorizeMode ? "Cancel Categorizing" : "Categorize Products"}
            </Button>
          </div>
        )}

        {/* Bulk Categorize Controls */}
        {bulkCategorizeMode && !showForm && (
          <Card className="mb-6 border-amber-200 bg-amber-50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="selectAll"
                      checked={selectedProducts.size === products.length && products.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded border-amber-300"
                    />
                    <Label htmlFor="selectAll" className="text-amber-800 font-medium">
                      Select All ({selectedProducts.size} selected)
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-amber-800">Categorize as:</Label>
                    <Select value={bulkCategory} onValueChange={setBulkCategory}>
                      <SelectTrigger className="w-48 border-amber-300 bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((category) => (
                          <SelectItem key={category.value} value={category.value}>
                            <div className="flex items-center gap-2">
                              <category.icon className="h-4 w-4" />
                              {category.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  onClick={handleBulkCategorize}
                  disabled={selectedProducts.size === 0 || isSaving}
                  className="bg-amber-600 hover:bg-amber-700"
                >
                  {isSaving ? "Categorizing..." : `Categorize ${selectedProducts.size} Products`}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Product Form */}
        {showForm && (
          <Card className="mb-6 border-teal-200">
            <CardHeader>
              <CardTitle className="text-slate-800">{editingProduct ? "Edit Product" : "Add New Product"}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Product Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., Chocolate Chip Cookies"
                      required
                      disabled={isSaving}
                      className="border-teal-200 focus:border-teal-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) => setFormData({ ...formData, category: value })}
                      disabled={isSaving}
                    >
                      <SelectTrigger className="border-teal-200 focus:border-teal-500">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((category) => (
                          <SelectItem key={category.value} value={category.value}>
                            <div className="flex items-center gap-2">
                              <category.icon className="h-4 w-4" />
                              {category.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="price">Selling Price ($)</Label>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      placeholder="0.00"
                      required
                      disabled={isSaving}
                      className="border-teal-200 focus:border-teal-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="unitCost">Unit Cost ($)</Label>
                    <Input
                      id="unitCost"
                      type="number"
                      step="0.01"
                      value={formData.unitCost}
                      onChange={(e) => setFormData({ ...formData, unitCost: e.target.value })}
                      placeholder="0.00"
                      disabled={isSaving}
                      className="border-teal-200 focus:border-teal-500"
                    />
                    <p className="text-xs text-slate-500">Cost to purchase/make this item</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity</Label>
                  <Input
                    id="quantity"
                    type="number"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    placeholder="0"
                    required
                    disabled={isSaving}
                    className="border-teal-200 focus:border-teal-500"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="timeRestriction"
                    checked={formData.hasTimeRestriction}
                    onCheckedChange={(checked) => setFormData({ ...formData, hasTimeRestriction: checked })}
                    disabled={isSaving}
                  />
                  <Label htmlFor="timeRestriction">Set time restrictions for this product</Label>
                </div>

                {formData.hasTimeRestriction && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-teal-50 rounded-lg">
                    <div className="space-y-2">
                      <Label htmlFor="startTime">Available From</Label>
                      <Input
                        id="startTime"
                        type="time"
                        value={formData.startTime}
                        onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                        required={formData.hasTimeRestriction}
                        disabled={isSaving}
                        className="border-teal-200 focus:border-teal-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="endTime">Available Until</Label>
                      <Input
                        id="endTime"
                        type="time"
                        value={formData.endTime}
                        onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                        required={formData.hasTimeRestriction}
                        disabled={isSaving}
                        className="border-teal-200 focus:border-teal-500"
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center space-x-2">
                  <Switch
                    id="secondTimeRestriction"
                    checked={formData.hasSecondTimeRestriction}
                    onCheckedChange={(checked) => setFormData({ ...formData, hasSecondTimeRestriction: checked })}
                    disabled={isSaving}
                  />
                  <Label htmlFor="secondTimeRestriction">Add second time restriction for this product</Label>
                </div>

                {formData.hasSecondTimeRestriction && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-blue-50 rounded-lg">
                    <div className="space-y-2">
                      <Label htmlFor="secondStartTime">Second Period - Available From</Label>
                      <Input
                        id="secondStartTime"
                        type="time"
                        value={formData.secondStartTime}
                        onChange={(e) => setFormData({ ...formData, secondStartTime: e.target.value })}
                        required={formData.hasSecondTimeRestriction}
                        disabled={isSaving}
                        className="border-teal-200 focus:border-teal-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="secondEndTime">Second Period - Available Until</Label>
                      <Input
                        id="secondEndTime"
                        type="time"
                        value={formData.secondEndTime}
                        onChange={(e) => setFormData({ ...formData, secondEndTime: e.target.value })}
                        required={formData.hasSecondTimeRestriction}
                        disabled={isSaving}
                        className="border-teal-200 focus:border-teal-500"
                      />
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button type="submit" className="bg-teal-600 hover:bg-teal-700" disabled={isSaving}>
                    {isSaving ? "Saving..." : editingProduct ? "Update Product" : "Add Product"}
                  </Button>
                  <Button type="button" variant="outline" onClick={resetForm} disabled={isSaving}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Category Tabs */}
        <Tabs value={activeCategory} onValueChange={setActiveCategory} className="w-full">
          <TabsList className="grid w-full grid-cols-5 mb-6">
            <TabsTrigger value="all" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              All ({products.length})
            </TabsTrigger>
            {CATEGORIES.map((category) => {
              const stats = getCategoryStats(category.value)
              const Icon = category.icon
              return (
                <TabsTrigger key={category.value} value={category.value} className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  {category.label} ({stats.total})
                </TabsTrigger>
              )
            })}
          </TabsList>

          <TabsContent value="all">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {CATEGORIES.map((category) => {
                const stats = getCategoryStats(category.value)
                const Icon = category.icon
                return (
                  <Card key={category.value} className="border-slate-200">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`p-2 rounded-full ${category.color}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-800">{category.label}</h3>
                          <p className="text-sm text-slate-600">{stats.total} products</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {stats.lowStock > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            {stats.lowStock} low stock
                          </Badge>
                        )}
                        {stats.outOfStock > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {stats.outOfStock} out of stock
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </TabsContent>

          {CATEGORIES.map((category) => (
            <TabsContent key={category.value} value={category.value}>
              <Card className="border-teal-200">
                <CardHeader>
                  <CardTitle className="text-slate-800 flex items-center gap-2">
                    <category.icon className="h-5 w-5" />
                    {category.label} ({getCategoryStats(category.value).total} products)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {getFilteredProducts().length === 0 ? (
                    <p className="text-slate-500 text-center py-8">No products in this category yet.</p>
                  ) : (
                    <div className="space-y-4">
                      {getFilteredProducts().map((product) => (
                        <Card key={product.id} className="border-slate-200">
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start">
                              <div className="flex items-start gap-3 flex-1">
                                {bulkCategorizeMode && (
                                  <div className="pt-1">
                                    <input
                                      type="checkbox"
                                      checked={selectedProducts.has(product.id)}
                                      onChange={(e) => handleProductSelect(product.id, e.target.checked)}
                                      className="rounded border-slate-300"
                                    />
                                  </div>
                                )}
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <h3 className="font-semibold text-slate-800 text-lg">{product.name}</h3>
                                    <Badge className={getCategoryColor(product.category)}>
                                      {CATEGORIES.find((c) => c.value === product.category)?.label || product.category}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center gap-4 mt-2">
                                    <span className="text-2xl font-bold text-teal-600">
                                      ${product.price.toFixed(2)}
                                    </span>
                                    <span className="text-sm text-slate-600">Cost: ${product.unitCost.toFixed(2)}</span>
                                    <Badge variant="outline" className="bg-green-50 text-green-700">
                                      <TrendingUp className="h-3 w-3 mr-1" />$
                                      {(product.price - product.unitCost).toFixed(2)} profit
                                    </Badge>
                                    <Badge variant={product.quantity <= 5 ? "destructive" : "secondary"}>
                                      {product.quantity} in stock
                                    </Badge>
                                    {product.timeRestriction && (
                                      <Badge variant="outline">
                                        {product.timeRestriction.startTime} - {product.timeRestriction.endTime}
                                      </Badge>
                                    )}
                                    {product.secondTimeRestriction && (
                                      <Badge variant="outline" className="ml-2">
                                        {product.secondTimeRestriction.startTime} -{" "}
                                        {product.secondTimeRestriction.endTime}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                              {!bulkCategorizeMode && (
                                <div className="flex gap-2">
                                  <Button size="sm" variant="outline" onClick={() => handleEdit(product)}>
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleDelete(product.id)}
                                    className="text-red-600 hover:text-red-700"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  )
}
