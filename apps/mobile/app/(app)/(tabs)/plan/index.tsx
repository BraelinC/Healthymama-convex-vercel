import { View, Text, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Calendar } from "lucide-react-native";

export default function PlanScreen() {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const meals = ["Breakfast", "Lunch", "Dinner"];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Meal Plan</Text>
        <Text style={styles.subtitle}>Plan your week ahead</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.weekRow}>
          {days.map((day, index) => (
            <View
              key={day}
              style={[
                styles.dayChip,
                index === 0 && styles.activeDayChip,
              ]}
            >
              <Text
                style={[
                  styles.dayText,
                  index === 0 && styles.activeDayText,
                ]}
              >
                {day}
              </Text>
            </View>
          ))}
        </View>

        {meals.map((meal) => (
          <View key={meal} style={styles.mealSection}>
            <Text style={styles.mealTitle}>{meal}</Text>
            <View style={styles.emptyMealSlot}>
              <Calendar size={24} color="#d1d5db" />
              <Text style={styles.emptyMealText}>Tap to add {meal.toLowerCase()}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fdf2f8",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1f2937",
  },
  subtitle: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 4,
  },
  content: {
    padding: 20,
  },
  weekRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  dayChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: "#ffffff",
  },
  activeDayChip: {
    backgroundColor: "#ec4899",
  },
  dayText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6b7280",
  },
  activeDayText: {
    color: "#ffffff",
  },
  mealSection: {
    marginBottom: 20,
  },
  mealTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 12,
  },
  emptyMealSlot: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#f3f4f6",
    borderStyle: "dashed",
  },
  emptyMealText: {
    fontSize: 14,
    color: "#9ca3af",
    marginTop: 8,
  },
});
