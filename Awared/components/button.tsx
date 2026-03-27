import { StyleSheet, View, Pressable, Text } from 'react-native';
import React from 'react'

type Props = {
  label: string;
};

export default function Button({ label }: Props) {
  return (
    <View style={styles.buttonContainer}>
      <Pressable style={styles.button} onPress={() => alert("Button (woah)")}>
        <Text style={styles.buttonLabel}>{label}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  buttonContainer: {
    width: 72,
    height: 72,
    marginHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 1,
  },
  button: {
    borderRadius: 10,
    borderColor: '#000',
    borderStyle: 'solid',
    borderWidth: 2,
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  buttonLabel: {
    color: '#000',
    fontSize: 16,
    textAlign: 'center',
  },
});

