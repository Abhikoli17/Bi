import React, { useEffect } from 'react';
import { StyleSheet, ActivityIndicator, Text, View } from "react-native";
import { router } from 'expo-router';
import { useAuthStore } from '../stores/authStore';

export default function Page() {
   const { token, isLoading, loadToken } = useAuthStore();
   
  useEffect(() => {
    loadToken();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      if (token) {
        router.replace('/(tabs)/datasets');
      } else {
        router.replace('/auth/login');
      }
    }
  }, [token, isLoading]);
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#3b82f6" />
      <View style={styles.main}>
        <Text style={styles.title}>Hello World</Text>
        <Text style={styles.subtitle}>This is the first page of your app.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    alignItems: "center",
    padding: 24,
  },
  main: {
    flex: 1,
    justifyContent: "center",
    maxWidth: 960,
    marginHorizontal: "auto",
  },
  title: {
    fontSize: 64,
    fontWeight: "bold",
  },
  subtitle: {
    fontSize: 36,
    color: "#38434D",
  },
});
