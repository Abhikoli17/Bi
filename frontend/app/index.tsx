import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { router } from 'expo-router';

export default function Page() {
  useEffect(() => {
    router.replace('/dashboard-builder');
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#3b82f6" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
});
