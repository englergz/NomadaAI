// Puerta de entrada: el MAPA es la pantalla principal de la app (su propósito).
// La primera vez se muestra el recorrido de bienvenida (/welcome); después, directo
// al mapa. La antigua portada (hero + estado del servicio) se retiró: la marca vive
// en el onboarding y en el propio mapa, y el estado del servicio se avisa en el mapa
// solo cuando falla (nada decorativo).
import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

import BootScreen from '@/components/boot-screen';
import MapScreen from './map';
import { ONBOARDED_KEY } from './welcome';

export default function Index() {
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDED_KEY)
      .then((v) => setOnboarded(!!v))
      .catch(() => setOnboarded(true)); // sin storage no bloqueamos la app
  }, []);

  // Nunca `null` indefinido: si el almacenamiento tarda (o falla en silencio), la
  // app se quedaba EN BLANCO sin salida. Se muestra la marca cargando.
  if (onboarded === null) return <BootScreen />;
  if (!onboarded) return <Redirect href="/welcome" />;
  return <MapScreen />;
}
